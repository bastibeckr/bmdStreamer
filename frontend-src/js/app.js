
var App = angular.module('streamCtrlApp', [
    'ngRoute',
    'btford.socket-io',
    'ui.bootstrap'
])
.config(['$routeProvider', function($routeProvider) {
    $routeProvider.when('/', {
        templateUrl: 'partials/frontpage.html',
        controller: 'mainCtrl',
    });
    $routeProvider.otherwise({redirectTo: '/'});
}])
.factory('ctrlSocket', function (socketFactory) {
  return socketFactory();
});

/**
 * Controllers
 */
App.controller('mainCtrl', ['$scope', 'ctrlSocket', function($scope, ctrlSocket) {

    // ctrlSocket.on('init', function(){
    //     // console.log('TEST', arguments);
    // });

    $scope.appData = {};

    ctrlSocket.on('data', function(data){
        angular.extend($scope.appData, data);
        console.log('Got data', data);
    });

    ctrlSocket.on('preview-img', function(data) {
        console.log('got preview-img', data);
        $scope.previewImgSrc = data.base64;
        // var canvas = document.getElementById('cnv-capture-preview');
        // var ctx = canvas.getContext('2d');

        // var uint8Arr = new Uint8Array(data.buffer);
        // var str = String.fromCharCode.apply(null, uint8Arr);
        // var base64String = btoa(str);

        // var img = new Image();
        // img.onload = function() {
        //     var x = 0;
        //     var y = 0;
        //     ctx.drawImage(this, x, y);
        // }
        // img.src = 'data:image/png;base64,' + base64String;
    });


    $scope.clickStart = function(){
        ctrlSocket.emit('browser-to-app', {test: 1});
    }

}]);