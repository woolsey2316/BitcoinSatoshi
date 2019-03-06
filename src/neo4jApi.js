require('file?name=[name].[ext]!../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');
var User = require('./models/User');
var UserCast = require('./models/UserCast');
var _ = require('lodash');

var neo4j = window.neo4j.v1;
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "bitcoin"));

function searchUsers(queryString) {
  var session = driver.session();
  return session
    .run(
      'MATCH (u:User) \
      WHERE u.PublicKey STARTS WITH {PublicKey} \
      RETURN u LIMIT 7',
      {PublicKey: queryString}
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

function getUser(pubKey) {
  var session = driver.session();
  return session
    .run(
      "MATCH (u:User) \
	  WHERE u.PublicKey STARTS WITH {pubKey}\
      OPTIONAL MATCH path = (u)-[r]->(gaveto:User) \
      RETURN u.PublicKey AS PublicKey, \
      collect([u,g,gaveto]) AS transactions \
      LIMIT 1", {pubKey})
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

function getGraph() {
  var session = driver.session();
  return session.run(
    'MATCH path = (u:User)-[g:GIVES]->(gaveto:User) \
    RETURN u.PublicKey, g.Value, gaveto.PublicKey \
    LIMIT {limit}', {limit: 100})
    .then(results => {
      session.close();
      var nodes = [], rels = [], i = 0;
      results.records.forEach(res => {
        nodes.push({PublicKey: res.get('u.PublicKey')});
        var source = i;
        i++;

        res.get('gaveto.PublicKey').forEach(PublicKeyR => {
          var user = {"PublicKey": PublicKeyR, label: 'User'};
          var target = _.findIndex(nodes, user);
          if (target == -1) {
            nodes.push(user);
            target = i;
            i++;
          }
          rels.push({source, target})
        })
      });

      return {nodes, links: rels};
    });
}

exports.searchUsers = searchUsers;
exports.getUser = getUser;
exports.getGraph = getGraph;

