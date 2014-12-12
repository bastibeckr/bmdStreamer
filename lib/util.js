var _ = require('lodash');


module.exports = {

/**
 * Utility to build command from object.
 *
 * @param  string  first param of "reduce"
 * @param  {[type]} k   key
 * @param  {[type]} v   value
 * @return string       string
 */
paramsArrayToObject: function(params){

    function reduceToObject(sum, next){
        return _.extend(next, sum);
    }

    return _.reduce(params, reduceToObject, params.shift());
},

/**
 * Convert a key/value object to array
 * suitable for child_process.spawn
 *
 * input: {key: val, anotherKey, nextVal}
 * output: ["-key", "val", "-anotherKey", "nextVal"]
 *
 * @param  {[type]} params [description]
 * @return {[type]}        [description]
 */
paramsObjectToArray: function(params){
    var regex = /^-/;
    function reduceToArray(arr, nextVal, nextKey){
        nextKey = ( nextKey.match(regex) ) ? nextKey.toString().trim() : "-" + nextKey.toString().trim();
        arr.push( nextKey.toString().trim() );
        if( !_.isEmpty(nextVal.toString().trim()) ){
            arr.push(nextVal.toString().trim());
        }
        return arr;
    }
    return _.reduce(params, reduceToArray, []);
},

/**
 * Builds a shell command from array of params + "base-command".
 *
 * @param  {[type]} baseCmd Base Command ('ffmpeg ')
 * @param  {[type]} params  object with params ( {'c:v': 'x264', 'r': 25})
 * @return {[type]}         command ( 'ffmpeg -c:v x264 -r 25')
 */
buildCmd: function(params, baseCmd ){
    function reduceToString(cmd, k, v){
        return cmd + ' -' + k + ' ' + v;
    }
    return _.reduce(params, reduceToString, baseCmd);
},


defaultsDeep: _.partialRight(_.merge, function deep(value, other) {
  return _.merge(value, other, deep);
})



};
