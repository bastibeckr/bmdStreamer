
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

    console.log('Hello from the Frontpage Controller');

    ctrlSocket.on('init', function(){
        console.log('TEST', arguments);
    });

    $scope.name = 'Paul';
}]);