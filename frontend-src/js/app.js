
var App = angular.module('streamCtrl', [
    'ngRoute',
    'btford.socket-io',
    'ui.bootstrap',
    'streamCtrlControllers',
    'streamCtrlFilters'

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
