var _ = require('lodash');

function UserCast(trade) {
  _.extend(this, {
    transactions: trade.map(function(c) {
      return {
        PublicKey: c[0],
        txs: c[1],
        bitcoin: c[2]
      }
    })
  });
}

module.exports = UserCast;
