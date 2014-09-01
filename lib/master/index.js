var etcdjs = require('../etcd')
var dockers = require('./dockers')
var Router = require('./router')

module.exports = function(opts){
	opts = opts || {}
	var etcd = etcdjs(opts)
	var docker = dockers(etcd, opts)
	var router = Router(etcd, opts, docker)
	return router
}