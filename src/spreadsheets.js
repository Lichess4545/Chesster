var GoogleSpreadsheet = require("google-spreadsheet");
var _ = require("lodash");

// getRows is a client side implementation of the record-type results that we
// got from the row based API. Instead, we now implement this in the following
// manner:
//   1. Query for all cells in a particular range.
//   2. Asssume first row is a header row.
//   3. Turn each subsequent row into an object, of key-values based on the header
//   4. return rows.
function getRows(spreadsheetConfig, options, sheetPredicate, callback) {
    var doc = new GoogleSpreadsheet(spreadsheetConfig.key);

    function getRowImplementation(err, info) {
        var targetSheet;

        if (err) {
            callback(err, undefined);
        }

        doc.getInfo(function(err, info) {
            if (err) { return callback(err, info); }
            // Find the last spreadsheet with the word "round" in the title.
            // this ought to work for both tournaments
            info.worksheets.forEach(function(sheet) {
                if (sheetPredicate(sheet)) {
                    targetSheet = sheet;
                }
            });
            if (!targetSheet) {
                callback("Unable to find target worksheet");
                return;
            }
            // Query for the appropriate row.
            // Again, this ought to work for both tournaments
            options = _.clone(options);
            var defaults = {
                'min-row': 1,
                'max-row': 100,
                'min-col': 1,
                'max-col': 8,
                'return-empty': true
            }
            options = _.defaults(options, defaults);
            targetSheet.getCells(
                options,
                function(err, cells) {
                    if (err) { return callback(err, cells); }

                    // Take the single list and turn it into rows
                    var rows = [];
                    cells.forEach(function(cell) {
                        // Create the empty row if needed.
                        if (!(cell.row in rows)) {
                            rows[cell.row] = [];
                        }
                        rows[cell.row][cell.col] = cell;
                    });

                    // Convert each row into a record with keys
                    var headerRow = rows[1];
                    headerRow = _.map(headerRow, function(item, i) {
                        if (item) {
                            return item.value.toLowerCase();
                        } else {
                            return i;
                        }
                    });
                    var recordRows = _.map(rows.slice(2), function(row) {
                        return _.zipObject(headerRow, row);
                    })
                    callback(undefined, recordRows);
                }
            );
        });
    }

    if (spreadsheetConfig.serviceAccountAuth) {
        doc.useServiceAccountAuth(spreadsheetConfig.serviceAccountAuth, getRowImplementation);
    } else {
        getRowImplementation();
    }
}




// getPairingRows returns the pairing rows from the spreadsheet
function getPairingRows(spreadsheetConfig, options, callback) {
    return getRows(
        spreadsheetConfig,
        options,
        function(sheet) {
            return sheet.title.toLowerCase().indexOf("round") !== -1;
        },
        callback
    );
}

// Finds the given pairing in one of the team spreadsheets
// callback gets three values: error, row, whether the pairing is reversed or not.
function findPairing(spreadsheetConfig, white, black, callback) {
    var options = {
        'min-col': 1,
        'max-col': 7
    };
    function rowMatchesPairing(row) {
        var rowBlack = row.black.value.toLowerCase();
        var rowWhite = row.white.value.toLowerCase();
        if (
            (rowBlack.indexOf(black) !== -1 && rowWhite.indexOf(white) !== -1)
        ) {
            return true;
        } else if (
            (rowWhite.indexOf(black) !== -1 && rowBlack.indexOf(white) !== -1)
        ) {
            return true;
        }
        return false;
    }
    getPairingRows(
        spreadsheetConfig,
        options,
        function(err, rows) {
            var filteredRows = _.filter(rows, rowMatchesPairing);
            // Only update it if we found an exact match
            if (filteredRows.length > 1) {
                return callback("Unable to find pairing. More than one row was returned!");
            } else if(filteredRows.length < 1) {
                return callback("Unable to find pairing. No rows were returned!");
            }
            var row = filteredRows[0];
            var rowBlack = row.black.value.toLowerCase();
            var rowWhite = row.white.value.toLowerCase();
            var reversed = false;
            if (rowWhite.indexOf(black) !== -1) {
                reversed = true
            }
            callback(undefined, row, reversed);
        }
    );
}


function parseHyperlink(hyperlink) {
    var results = {
        'text': '',
        'href': ''
    };
    if(!hyperlink.toUpperCase().includes("HYPERLINK")) {
        return results;
    }
    var parts = hyperlink.split("\"");
    if (parts.length !== 5) {
        return results;
    }
    if (!_.isEqual(parts[0].toUpperCase(), "=HYPERLINK(")) {
        return results;
    }
    results['href'] = parts[1];
    results['text'] = parts[3];
    return results;
}

module.exports.getRows = getRows;
module.exports.parseHyperlink = parseHyperlink;
module.exports.getPairingRows = getPairingRows;
