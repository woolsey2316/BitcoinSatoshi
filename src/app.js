var api = require('./neo4jApi');

$(function() {
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
      user.transactions.forEach(transaction=> {
        if (transaction.PublicKeyS == pubKey) {
          $sentList.append(
            $("<li>" + transaction.PublicKeyR + " " +
              Math.round(transaction.bitcoin * 100) / 100 +
              "</li>"));
        } else {
          $receivedList.append(
            $("<li>" + transaction.PublicKeyS + " " +
              Math.round(transaction.bitcoin * 100) / 100 +
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
              var pubKey = $(this).find("td.user").text();
              showUser(pubKey);
              renderGraph(pubKey);
              renderChordDiagram(pubKey);
            })
        });
        var first = users[0];
        if (first) {
          showUser(first.PublicKey);
        }
      }
    });
}

function renderGraph(pubKey) {
  var width = 1000,
    height = 800;
  var force = d3.layout.force()
    .charge(-200).linkDistance(30).size([width, height]);

  var svg = d3.select("#graph").append("svg")
    .attr("width", "100%").attr("height", "100%")
    .attr("pointer-events", "all");

  api
    .getGraph(pubKey)
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

function renderChordDiagram(pubKey) {
  var r1 = 960 / 2,
    r0 = r1 - 120;

  var fill = d3.scale.category20c();

  var chord = d3.layout.chord()
    .padding(.04)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending);

  var arc = d3.svg.arc()
    .innerRadius(r0)
    .outerRadius(r0 + 20);

  var svg = d3.select("#graph").append("svg")
    .attr("width", r1 * 2)
    .attr("height", r1 * 2)
    .append("g")
    .attr("transform", "translate(" + r1 + "," + r1 + ")");

  function fade(opacity) {
    return function(g, i) {
      svg.selectAll("g path.chord")
        .filter(function(d) {
          return d.source.index != i && d.target.index != i;
        })
        .transition()
        .style("opacity", opacity);
    };
  }

  function draw() {
    var indexByName = {},
      nameByIndex = {},
      matrix = [],
      n = 0;

    function publicKey(publicKey) {
      return publicKey
    }

    api
      .getChordDiagram(pubKey)
      .then(results => {
        results.records.forEach(res => {
        // Compute a unique index for each name.
          var sender = publicKey(res.get('sender'));
          var receiver = publicKey(res.get('receiver'));
          if (!(sender in indexByName)) {
            nameByIndex[n] = sender;
            indexByName[sender] = n++;
          }
          if (!matrix[n-1]) {
            matrix[n-1] = [];
            for (var i = -1; ++i < n;) matrix[n-1].push(0);
          }
          receiver = publicKey(receiver);
          if (!(receiver in indexByName))
            nameByIndex[n] = receiver;
            indexByName[receiver] = n
            matrix[indexByName[sender]].push(res.get('bitcoin'));
            if (!matrix[n-1]) {
              matrix[n-1] = [];
              for (var i = -1; ++i < n;) matrix[n-1].push(0);
            } else {
                matrix[indexByName[sender]][indexByName[receiver]] = res.get('bitcoin');
            }
        });
        var matrix_copy = [];
        for(var i=0; i<n; i++) {
            matrix_copy[i] = Array.apply(null, Array(n)).map(Number.prototype.valueOf,0);
        }
        for (var i = 0; i < matrix.length; i++)
          for (var i = 0; i < matrix.length; i++)
            if (matrix[i][j] != undefined) {
                matrix_copy[i][j] = matrix[i][j];
            }
        chord.matrix(matrix_copy);
        console.log(matrix_copy);

        var g = svg.selectAll("g.group")
          .data(chord.groups)
          .enter().append("g")
          .attr("class", "group");

        g.append("path")
        .style("fill", function(d) {
          return fill(d.index);
        })
        .style("stroke", function(d) {
          return fill(d.index);
        })
        .attr("d", arc);

        g.append("text")
        .each(function(d) {
          d.angle = (d.startAngle + d.endAngle) / 2;
        })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) {
          return d.angle > Math.PI ? "end" : null;
        })
        .attr("transform", function(d) {
          return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")" +
            "translate(" + (r0 + 26) + ")" +
            (d.angle > Math.PI ? "rotate(180)" : "");
        })
        .text(function(d) {
          return nameByIndex[d.index];
        });

        svg.selectAll("path.chord")
        .data(chord.chords)
        .enter().append("path")
        .attr("class", "chord")
        .style("stroke", function(d) {
          return d3.rgb(fill(d.source.index)).darker();
        })
        .style("fill", function(d) {
          return fill(d.source.index);
        })
        .attr("d", d3.svg.chord().radius(r0));
      });
    }
  draw();
}
