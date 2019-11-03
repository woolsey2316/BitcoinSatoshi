var _ = require('lodash');

function TimePlot(timeseries) {
  _.extend(this, {
    timeseries: timeseries.map(function(c) {
      return {
        date: c[0],
        profit: c[1],
      }
    })
  });
}

module.exports = TimePlot;