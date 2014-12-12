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
    $scope.settings = {};

    ctrlSocket.on('data', function(data){
        console.log('Got data from server', data, $scope.appData);
        angular.extend($scope.appData, data);

    });


    ctrlSocket.on('settings-change', function(data){
        // $scope.settings = data;
        console.log('Got SETTINGS from server', data, $scope.settings);
        angular.extend($scope.settings, data);
    });


    ctrlSocket.on('gotData', function(data){
        var logData = data.chunk.split('\n');
        logData.forEach(function(entry, index){
            if(!entry.trim().length){
                logData.splice(index, 1);
            }
        });
        $scope.logs = $scope.logs.concat(logData);
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


    $scope.$watch('settings', function(newValue, oldValue) {
        console.log('Scope changed.', arguments);
        ctrlSocket.emit('browser-to-app', {
            settings: $scope.settings,
            action: 'settings-change'
        });
    }, true);
}]);
