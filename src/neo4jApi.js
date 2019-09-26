require('file?name=[name].[ext]!../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');
var User = require('./models/User');
var UserCast = require('./models/UserCast');
var _ = require('lodash');

var neo4j = window.neo4j.v1;
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "bitcoin"));

function searchUsers(queryString) {
  var session = driver.session();
  return session.run(
      "MATCH (u:User) WHERE u.PublicKey STARTS WITH \"1dice\" \
      RETURN u ORDER BY u.revenue DESCENDING", {
        PublicKey: queryString
      }
    )
    .then(result => {
      session.close();
      return result.records.map(record => {
        return new User(record.get('u'));
      });
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getTransactionWinnings(pubKey) {
  var session = driver.session();
  return session
    .run(
      "MATCH (sent:User)-[:GIVES]-(b:Bitcoin)-[:SENDS]-(v) WHERE v.PublicKey = {pubKey} WITH sent as sent, SUM(b.value) as winnings, count(b) as txs ORDER BY txs DESC RETURN collect([sent.PublicKey, txs, winnings]) as transactions LIMIT 5", {
        pubKey
      })
    .then(result => {
      session.close();

      if (_.isEmpty(result.records))
        return null;
      var record = result.records[0];
      return new UserCast(record.get('transactions'));
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getTransactionLosses(pubKey) {
  var session = driver.session();
  return session
    .run(
      "MATCH (sent:User)-[:GIVES]-(b:Bitcoin)-[:SENDS]-(v) WHERE sent.PublicKey = {pubKey} WITH v as v, SUM(b.value) as winnings, count(b) as txs ORDER BY txs DESC RETURN collect([v.PublicKey, txs, winnings]) as transactions LIMIT 5", {
        pubKey
      })
    .then(result => {
      session.close();

      if (_.isEmpty(result.records))
        return null;
      var record = result.records[0];
      return new UserCast(record.get('transactions'));
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getGraph(pubKey) {
  var session = driver.session();
  return session.run(
      "MATCH (u:User\{PublicKey:{pubKey}\})-[g:GIVES]-(b:Bitcoin)-[:SENDS]-(gaveto:User) \
    RETURN u.PublicKey, b.value, gaveto.PublicKey", {
        pubKey
      })
    .then(results => {
      session.close();
      var nodes = [],
        rels = [],
        i = 0;
      results.records.forEach(res => {
        nodes.push({
          PublicKey: res.get('u.PublicKey')
        });
        var source = i;
        i++;

        var PublicKeyR = res.get('gaveto.PublicKey');
        var user = {
          label: PublicKeyR,
          r: res.get('b.value')
        };
        var target = _.findIndex(nodes, user);
        if (target == -1) {
          nodes.push(user);
          target = i;
          i++;
        }
        rels.push({
          source,
          target
        })
      });

      return {
        nodes,
        links: rels
      };
    });
}

function getChordDiagram(pubKey) {
  var session = driver.session();
  return session.run(
      "MATCH (u:User)-[:GIVES]-(b:Bitcoin)-[:SENDS]-(gaveto:User) \
      WHERE gaveto.PublicKey STARTS WITH \"1dice\" AND u.PublicKey STARTS WITH \"1dice\" \
    RETURN u.PublicKey as sender, b.value as bitcoin, gaveto.PublicKey as receiver", {
        pubKey
      })
    .then(results => {
      session.close();
      return results;
    });
}

function getLineChart(pubKey) {
  var session = driver.session();
  return session.run(
    "MATCH (u:User\{PublicKey: {pubKey}\})-[:SENDS]-(b:Bitcoin) \
    WITH date(datetime({epochmillis:b.date})) as time, b \
    MATCH (btc:Bitcoin)-[:GIVES]-(u:User\{PublicKey: {pubKey}\}) \
    WITH date(datetime({epochmillis:btc.date})) as time, b, btc \
    RETURN time, sum(btc.value) - sum(b.value) as profit \
    ORDER BY time ASCENDING", {
        pubKey
      })
    .then(results => {
      session.close();
      return results;
    });
}

exports.searchUsers = searchUsers;
exports.getTransactionWinnings = getTransactionWinnings;
exports.getTransactionLosses = getTransactionLosses;
exports.getGraph = getGraph;
exports.getChordDiagram = getChordDiagram;
exports.getLineChart = getLineChart;
