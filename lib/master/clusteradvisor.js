var advisor = require('cluster-advisor')

module.exports = function(servers, done){

	var serverMap = {}

	var cadvisors = Object.keys(servers || {}).map(function(key){
		var server = servers[key]
		var ip = server.docker.split(':')[0]
		var cadvisor = ip + ':8085'
		serverMap[ip] = key
		return cadvisor
	})

	var cluster = advisor(cadvisors)

	return cluster
}