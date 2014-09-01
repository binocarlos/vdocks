var url = require('url')

function locate(etcd, opts, dockers){
	return function(req, res, opts){

		var id = opts.params.id

		if(!id){
			res.statusCode = 500
			res.end('id option required')
		}

		var query = url.parse(req.url, true).query
		var field = query.field

		dockers.find(id, function(err, backend){

			if(err){
				res.statusCode = 500
				res.end(err)
				return
			}

			if(!backend){
				res.statusCode = 404
				res.end(id + ' not found')
				return
			}

			if(!(field || '').match(/\w/)){
				res.end(JSON.stringify(backend))
			}
			else{
				backend.ip = backend.docker.split(':')[0]

				if(!backend[field]){
					res.statusCode = 500
					res.end(field + ' property not found')
					return
				}

				res.end(backend[field].toString())
			}
		})


	}
}

module.exports = locate