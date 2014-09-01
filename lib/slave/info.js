module.exports = function(opts){
	return {
		hostname:opts.hostname,
		ip:opts.ip,
		masters:opts.masters,
		masterport:opts.masterport,
		dockerport:opts.dockerport,
		etcdport:opts.etcdport,
		etcdpeerport:opts.etcdpeerport,
		etcdpath:opts.etcdpath
	}
}