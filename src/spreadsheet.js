const _ = require("lodash");

module.exports = function(key, creds){
    var GoogleSpreadsheet = require('google-spreadsheet');
    var async = require('async');
    var doc = new GoogleSpreadsheet(key);
    
    function onSpreadsheet(callback){
      async.series([
    	      function setAuth(step) {
    		  doc.useServiceAccountAuth(creds, step);
    	      },
    	      function getInfoAndWorksheets(step) {
    		callback();
    		step();
                  }]);
    }
    
    function writeLine(tab, line, data){
        onSpreadsheet(function(){
            doc.getCells(tab, {
                "min-row": line,
                "max-row": line,
                "min-col": 1,
                "max-col": data.length,
                "return-empty": true
            }, function(err, cells){
                for (var i = 0; i < data.length; i++){
    	        cells[i].value = data[i];
    		cells[i].save(_.noop());
    	    }
    	});
        });
    }
    
    function findFirstBlankLine(tab, callBack){
      onSpreadsheet(function(){
          doc.getCells(tab, {
              "min-row": 1,
    	  "max-row": 50,
    	  "min-col": 1,
    	  "max-col": 1,
    	  "return-empty": true
          }, function(err, cells){
    	  for (var i = 0; i < cells.length; i++){
    	      var cell = cells[i];
    	      if (cell.value === ""){
    		  callBack(cell.row);
    		  break;
    	      }
    	  }
          });
      });
    }

    return {
        findFirstBlankLine: findFirstBlankLine,
        writeLine: writeLine
    };
};