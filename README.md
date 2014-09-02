vdocks
-----

A combination of [arpanet](https://github.com/binocarlos/arpanet) and [mdock](https://github.com/binocarlos/mdock).

vdocks is the core code for the [viking](https://github.com/binocarlos/viking) master but without the opinionated PaaS parts around it.

## install

```bash
$ npm install vdocks
```

## usage

```js
var http = require('http')
var vdocks = require('vdocks')

var options = {
	ip:'192.168.8.120',
	hostname:'node1',
	masters:'192.168.8.120,192.168.8.121,192.168.8.122',
	dockerport:2375,
	masterport:8791,
	etcdport:4001,
	etcdpeerport:7001,
	etcdpath:'/arpanet'
}

var master = vdocks.master(options)

// we can customize using the master.router (which is a routes-router)
master.router.addRoute('/my/custom/route', function(req, res){

})

// server is now a (mostly) docker compatable HTTP endpoint
var server = http.createServer(master.router)
server.listen(options.masterport)


// this is how non-master nodes are registered onto the network
var slave = vdocks.slave(options)
slave.join(options)
slave.leave()

// you can also grab the etcd client
var etcd = vdocks.etcd(options)
```

## license

MIT