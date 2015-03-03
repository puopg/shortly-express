var db = require('../config');
var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcrypt-nodejs'));

var User = db.Model.extend({
    tableName: 'users',
    hasTimestamps: true,

    initialize: function(){
      this.on('creating', function(model, attrs, options){
        return bcrypt.hashAsync(model.get('password'), null, null).then(function(hash) {
            model.set('password', hash);
        });
      });
    }
});


module.exports = User;