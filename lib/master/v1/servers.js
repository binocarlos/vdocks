var Inventory = require('../inventory')
var advisor = require('../clusteradvisor')
var async = require('async')

function serverjson(etcd, opts, dockers){

	var inventory = Inventory(etcd, opts)
	return function(req, res, opts){
		var id = opts.params.id
		async.parallel({
			inventory:function(next){
				inventory.json(next)
			},
			cluster:function(next){
				inventory.list(function(err, servers){
					if(err) return next(err)
					var cluster = advisor(servers)
					cluster.stats(next)
				})
			}
		}, function(err, results){
			if(err){
				res.statusCode = 500
				res.end(err)
				return
			}

			var map = {}
			results.inventory.forEach(function(s){
				map[s.ip] = s
			})
			results.cluster.forEach(function(c){
				var ip = c.backend.split(':')[0]
				var s = map[ip]

				Object.keys(c || {}).forEach(function(key){
					if(key!='backend'){
						s[key] = c[key]
					}
				})
			})
			res.setHeader('content-type', 'application/json')
			res.end(JSON.stringify(results.inventory))
		})
		
	}
}

module.exports = serverjson