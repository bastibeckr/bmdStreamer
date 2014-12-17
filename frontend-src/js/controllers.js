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
    $scope.formatPresets = {};

    $scope.inputModelOptions = {
        updateOn: 'blur',
        debounce: {
            'default': 500,
            'blur': 0
        }
    };

    ctrlSocket.on('data', function(data){
        console.log('Got data from server', data, $scope.appData);
        angular.extend($scope.appData, data);
    });


    ctrlSocket.on('settings-change', function(data){
        // $scope.settings = data;
        console.log('Got SETTINGS from server', data, $scope.settings);
        angular.extend($scope.settings, data);
    });

    ctrlSocket.on('presets-change', function(data){
        // $scope.settings = data;
        console.log('Got PRESETS from server', data );
        angular.extend($scope.formatPresets, data);
    });

    ctrlSocket.on('log', function(data){
        // var logData = data.chunk.split('\n');
        var maxLength = 100;
        console.log('ON LOG', data);
        $scope.logs.unshift( data.chunk );
        if( $scope.logs.length > maxLength ){
            $scope.logs.splice(-1, 1);
        }
    });


    ctrlSocket.on('preview-img', function(data) {
        console.log('got preview-img', data);
        $scope.previewImgSrc = data.base64;
    });


    $scope.clickPreview = function(){
        $scope.waitingForPreview = true;
        ctrlSocket.emit('browser-to-app', {action: 'preview'}, function(){
            $scope.waitingForPreview = false;
            console.log('BROWSER TO APP Callback', arguments);
        });
    };

    $scope.clickStart = function(){
        ctrlSocket.emit('browser-to-app', {action: 'streaming'}, function(){
            console.log('BROWSER TO APP Callback', arguments);
        });
    };

    $scope.clickSave = function(){
        $scope.savingSettings = true;
        ctrlSocket.emit('browser-to-app', {action: 'settings-save'}, function(){
            $scope.savingSettings = false;
            console.log('BROWSER TO APP Callback', arguments);
        });
    }

    $scope.$watch('settings', function(newValue, oldValue) {
        console.log('Scope changed.', arguments);
        ctrlSocket.emit('browser-to-app', {
            settings: $scope.settings,
            action: 'settings-change'
        });
    }, true);
}]);
