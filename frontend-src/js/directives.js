var mod = angular.module('streamCtrlDirectives', []);

mod.directive('myHolder', [function() {
  return {
    link: function(scope, element, attrs) {
        attrs.$set('data-src', attrs.myHolder);
        window.Holder.run({images:element[0], nocss:true});
    }
  };
}]);
