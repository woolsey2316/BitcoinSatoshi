var _ = require('lodash');

function Transaction(transaction) {
  _.extend(this, {
    transactions: transaction.map(function(c) {
      return {
        PublicKey: c[0],
        txs: c[1],
        bitcoin: c[2]
      }
    })
  });
}

module.exports = Transaction;
