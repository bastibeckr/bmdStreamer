/**
 * Controllers
 */
angular.module('streamCtrlControllers', ['ngRoute'])

.controller('mainCtrl', ['$scope', 'ctrlSocket', function($scope, ctrlSocket) {

    // ctrlSocket.on('init', function(){
    //     // console.log('TEST', arguments);
    // });

    $scope.appData = {};
    $scope.logs = [];
    ctrlSocket.on('data', function(data){
        angular.extend($scope.appData, data);
        console.log('Got data',data, $scope.appData);
    });

    ctrlSocket.on('data', function(data){
        angular.extend($scope.appData, data);
        console.log('Got data', data);
    });

    ctrlSocket.on('log', function(data){
        $scope.logs.push(data);
    });

    ctrlSocket.on('preview-img', function(data) {
        console.log('got preview-img', data);
        $scope.previewImgSrc = data.base64;
    });


    $scope.clickPreview = function(){
        ctrlSocket.emit('browser-to-app', {action: 'preview'});
    };

    $scope.clickStart = function(){
        ctrlSocket.emit('browser-to-app', {action: 'streaming'}, function(){
            console.log('BROWSER TO APP Callback', arguments);
        });
    };

}]);