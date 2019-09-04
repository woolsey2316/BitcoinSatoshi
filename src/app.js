var api = require('./neo4jApi');

$(function () {
  renderGraph();
  search();

  $("#search").submit(e => {
    e.preventDefault();
    search();
  });
});

function showUser(pubKey) {
  api
    .getUser(pubKey)
    .then(user => {
      if (!user) return;

      document.getElementById("public-key").innerHTML = "Transaction Details: " + pubKey;
      var $sentList = $("#traders").empty();
	  var $receivedList = $("#received").empty();
      user.transactions.forEach(transactions => {
		if (transactions.PublicKeyS == pubKey) {
			$sentList.append(
				$("<li>" + transactions.PublicKeyR + " " + 
				Math.round(transactions.bitcoin * 100) / 100  +
				"</li>"));
		} else {
			$receivedList.append(
				$("<li>" + transactions.PublicKeyS + " " + 
				Math.round(transactions.bitcoin * 100) / 100 + 
				"</li>"));
		}
      });
    }, "json");
}

function search() {
  var query = $("#search").find("input[name=search]").val();
  api
    .searchUsers(query)
    .then(users => {
      var t = $("table#results tbody").empty();

      if (users) {
        users.forEach(user => {
          $("<tr><td class='user'>" + user.PublicKey + "</td><td>" + 
			Math.round(user.revenue * 100) / 100 + "</td><td>" + 
			Math.round(user.loss * 100) / 100 + "</td></tr>")
			.appendTo(t)
            .click(function() {
              showUser($(this).find("td.user").text());
            })
        });

        var first = users[0];
        if (first) {
          showUser(first.PublicKey);
        }
      }
    });
}

function renderGraph() {
  var width = 1000, height = 800;
  var force = d3.layout.force()
    .charge(-200).linkDistance(30).size([width, height]);

  var svg = d3.select("#graph").append("svg")
    .attr("width", "100%").attr("height", "100%")
    .attr("pointer-events", "all");

  api
    .getGraph()
    .then(graph => {
      force.nodes(graph.nodes).links(graph.links).start();

      var link = svg.selectAll(".link")
        .data(graph.links).enter()
        .append("line").attr("class", "link");

      var node = svg.selectAll(".node")
        .data(graph.nodes).enter()
        .append("circle")
        .attr("class", d => {
          return "node " + d.label
        })
        .attr("r", 10)
        .call(force.drag);

      // html pubKey attribute
      node.append("pubKey")
        .text(d => {
          return d.pubKey;
        });

      // force feed algo ticks
      force.on("tick", () => {
        link.attr("x1", d => {
          return d.source.x;
        }).attr("y1", d => {
          return d.source.y;
        }).attr("x2", d => {
          return d.target.x;
        }).attr("y2", d => {
          return d.target.y;
        });

        node.attr("cx", d => {
          return d.x;
        }).attr("cy", d => {
          return d.y;
        });
      });
    });
}
