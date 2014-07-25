//define a global application
var App = angular.module('App', []);

//create an app router for url management and redirect
App.config(function($routeProvider) {
    $routeProvider.when('/frontpage', {
        templateUrl: 'partials/frontpage.html',
        controller: 'frontpage',
    });
    $routeProvider.otherwise({redirectTo: '/frontpage'});
});

//frontpage controller
App.controller('frontpage', function($scope) {
    console.log('Hello from the Frontpage Controller');
    $scope.name = 'Paul';
});