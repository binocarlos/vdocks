module.exports = function(section){
	return function(message){
		console.log(dateString() + ' ' + section + ': ' + message)
	}
}