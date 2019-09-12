var _ = require('lodash');

function UserCast(trade) {
  _.extend(this, {
    transactions: trade.map(function(c) {
      return {
        PublicKeyS: c[0],
        bitcoin: c[1],
        PublicKeyR: c[2]
      }
    })
  });
}

module.exports = UserCast;
