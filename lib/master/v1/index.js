var Router = require('routes-router')
var servers = require('./servers')
var locate = require('./locate')

module.exports = function(etcd, opts, dockers){
	var router = Router()
	router.addRoute('/servers/json', servers(etcd, opts, dockers))
	router.addRoute('/servers/:id/json', servers(etcd, opts, dockers))
	router.addRoute('/locate/:id', locate(etcd, opts, dockers))
	return router
}