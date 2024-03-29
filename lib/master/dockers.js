var mdock = require('mdock')
var mdockcache = require('mdock-cache')
var flatten = require('etcd-flatten')
var dowding = require('dowding')

var logger = require('../logger')
var async = require('async')
var job = require('./job')
var leastbusyserver = require('./leastbusyserver')
var State = require('./state')
var Inventory = require('./inventory')
var PortAllocator = require('./portallocator')

module.exports = function(etcd, opts){
	var dockers = mdock()
	var inventory = Inventory(etcd, opts)
	var state = State(etcd, opts)
	var portAllocator = PortAllocator(etcd, opts)

	var logger = logger('viking dockers')

	/*
	
		TODO - fix up dowding to read cadvisor to choose the least busy
		
	*/
	var scheduler = dowding({
		inventory:function(done){
			inventory.list(done)
		},
		leastBusy:leastbusyserver
	})

	dockers.on('request', function(req, res){
		logger('req ' + req.method + ' ' + req.url)
	})

	dockers.on('list', function(next){

		inventory.list(function(err, servers){
			if(err) return next(err)
			next(null, servers)
		})
	})

	/*
	
		we need to add a 'filter' function to mdock

		this will filter the inventory before passing
		the list of servers to dowding for allocation

		this means we can call a server 'full'

		
	*/

	dockers.on('route', mdockcache(function(info, next){

		var container = info.container

		if(!container){
			next('no container found from routing info')
		}

		/*
		
			here we need to:

			 * check the VIKING_VOLUMEFROM_X variables and ensure they all live together
			 * if defined then manually route to discovered host
			
		*/
		var allocateInfo = {
			name:info.name
		}

		var volumesFrom = job.envVolumesFrom(container.Env)

		function doAllocation(){
			scheduler.allocate(allocateInfo, function(err, server){
				if(err) return next(err)
				logger('dowding route: ' + info.name + '=' + server.hostname)
				next(null, server)
			})	
		}

		/*
		
			Volume From routing

			make sure the targets are all on the same server and the route to that server
			
		*/
		if(volumesFrom.length>0){

			var map = {}
			
			async.forEach(volumesFrom, function(name, nextName){
				dockers.find(name, function(err, backend){
					if(!backend) err = name + ' was not found to link to'
					if(err) return nextName(err)
					map[backend.hostname] = backend
					nextName()
				})
			}, function(err){
				if(err) return next(err)
				if(Object.keys(map).length>1){
					// yikes we have multiple volume froms and they are on different servers
					return next('unroutable volume-from command ' + volumesFrom.join(', ') + ' are on multiple servers')
				}

				// bypass dowding and route directly
				var server = map[Object.keys(map)[0]]
				logger('fixed route: ' + info.name + '=' + server.hostname)
				next(null, server)
			})
		}
		else{
			doAllocation()
		}
	}))

	dockers.on('map', function(info, done){

		var name = info.name
		var container = info.container
		var image = info.image
		var backend = info.backend

		/*
		
			here we need to:

       * extract the service name from the name (mongo.2 = mongo)
			 * study the container for exposed ports
			 * for each port create a SERVICE_$PORT_NAME=mongo
			 * save service ports to the state (for linked things)
			 * study the links and if > 0 then replace with a link to 'backends'
			 * for each link - inject the envrionment based on the servicename
			
		*/

		var serviceName = job.serviceName(name)
		var exposedPorts = job.getExposedTCPPorts(container, image)
		var links = job.envLinks(container.Env)

		exposedPorts.forEach(function(port){
			// -e "SERVICE_27017_NAME=mystack_mongo_27017" \
			logger('expose: ' + name + ':' + port)
			container.Env.push('SERVICE_' + port + '_NAME=' + serviceName + '_' + port)
		})

		/*
		
			Registrator config

			inject the service names for each exposed port
			
		*/

		async.series([

			// Save exposed ports

			// save ports to state for links to this container to load from

			function(nextStep){

				if(exposedPorts.length<=0){
					return nextStep()
				}

				state.setServicePorts(serviceName, exposedPorts, nextStep)
			},
				
			// Link injection

			// loop links
			// load link ports
			// loop link ports
			// get allocated port from state
			// inject backend_ allocated ambassador env //"BACKEND_$ALLOCATED_MONGO_PORT=etcd://$VIKING_ETCD/viking/network/mystack_mongo_27017" \
			// if first link port create shortcut env //"MYSTACK_MONGO_PORT=tcp://backends:$ALLOCATED_MONGO_PORT" \
			// for each link port create env //"MYSTACK_MONGO_PORT_27017_TCP=tcp://backends:$ALLOCATED_MONGO_PORT" \
			function(nextStep){

				if(links.length<=0){
					return nextStep()
				}

				async.forEachSeries(links, function(link, nextLink){
					var parts = link.split(':')

					var externalLink = parts[0]
					var internalLink = parts[1]

					var linkName = job.serviceName(externalLink)
					var envName = job.envName(externalLink)
					var internalName = job.envName(internalLink)
					var etcdhost = opts.ip + ':' + opts.etcdport

					state.getServicePorts(linkName, function(err, ports){

						if(err) return nextLink(err)
						if(!ports || ports.length<=0){
							return nextLink('no linked data found for: ' + linkName)
						}

						var defaultPort = ports[0]

						async.forEach(ports || [], function(port, nextPort){
							var portName = linkName + '_' + port

							// get allocated port (auto-incrementing)
							portAllocator(state, portName, function(err, internalPort){
								if(err) return nextPort(err)

								//BACKEND_1234 = tells ambassador about the internal port -> etcd
								container.Env.push('BACKEND_' + internalPort + '=etcd://' + etcdhost + '/' + opts.etcdpath + '/network/' + portName)

								// the shortcut for the first port
								if(port==defaultPort){
									container.Env.push(internalName + '_PORT=tcp://arpanet_backends:' + internalPort)
								}

								container.Env.push(internalName + '_PORT_' + port + '_TCP=tcp://arpanet_backends:' + internalPort)
								container.Env.push(internalName + '_PORT_' + port + '_TCP_PROTO=tcp')
								container.Env.push(internalName + '_PORT_' + port + '_TCP_PORT=' + internalPort)
								container.Env.push(internalName + '_PORT_' + port + '_TCP_ADDR=arpanet_backends')

								logger('link: ' + name + ':' + externalLink)

								nextPort()
							})

						}, nextLink)
					})

				}, nextStep)

			}
		], done)


	})

	dockers.on('start', function(info, next){
		
		var name = info.name
		var container = info.container
		var image = info.image
		var bootRecord = info.boot
		var backend = info.backend

		// check if there are links and if yes replace bootRecord links with backend
		if(bootRecord.Links && bootRecord.Links.length>0){
			bootRecord.Links = ['arpanet_backends.' + backend.hostname + ':arpanet_backends']
		}

		logger('start: ' + name)

		next()
	})
	
	return dockers
}