var api = require('./neo4jApi');

$(function() {
  search()
  $("#search").submit(e => {
    e.preventDefault();
    search();
  });
});

function showTransaction(pubKey) {
  api
    .getTransactionLosses(pubKey)
    .then(res => {
      if (!res) return;
      document.getElementById("public-key").innerHTML = "Transaction log: " + pubKey;
      var $sentList = $("#senders").empty();
      res.transactions.forEach(transaction => {
          $sentList.append(
            $("<tr><td class='user'>" + transaction.PublicKey + "</td><td>" +
                transaction.txs + "</td><td>" +
                Math.round(transaction.bitcoin * 100) / 100 + "</td></tr>"));

      });
    });

    api
      .getTransactionWinnings(pubKey)
      .then(res => {
        if (!res) return;
        var $receiverList = $("#receivers").empty();
        res.transactions.forEach(transaction => {
            $receiverList.append(
              $("<tr><td class='user'>" + transaction.PublicKey + "</td><td>" +
              transaction.txs + "</td><td>" +
              Math.round(transaction.bitcoin * 100) / 100 + "</td></tr>"));
        });
      });
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
              showTransaction(pubKey);
              renderLineChart(pubKey);
              //renderGraph(pubKey);
              //renderChordDiagram(pubKey);
            })
        });
        var first = users[0];
        if (first) {
          showTransaction(first.PublicKey);
        }
      }
    });
}

function renderGraph(pubKey) {
  var width = 1000,
    height = 800

  var svg = d3.select("#graph svg")
    .attr("width", "100%").attr("height", "100%")
    .attr("pointer-events", "all");

  api
    .getGraph(pubKey)
    .then(graph => {

      var simulation = d3.forceSimulation(graph.nodes)
        .force("charge", d3.forceManyBody().strength(-700).distanceMin(1000).distanceMax(1000))
        .force("link", d3.forceLink(graph.links).id(function(d) { return d.index }))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("y", d3.forceY(0.001))
        .force("x", d3.forceX(0.001))
        //v3 -- .charge(-700).linkDistance(30).size([width, height]);

      var link = svg.selectAll(".link")
        .data(graph.links)
        .enter()
        .append("line")
        .attr("class", "link");

      var node = svg.selectAll(".node")
        .data(graph.nodes)
        .enter()
        .append("circle")
        .attr("class", d => {
          return "node " + d.label
        })
        .call(simulation.drag);

      // html pubKey attribute
      node.append("pubKey")
        .text(d => {
          return d.pubKey;
        });

      // force feed algo ticks
      simulation.on("tick", () => {
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
    r0 = r1 - 120

  var chord = d3.chord()
    .padAngle(.01)
    .sortSubgroups(d3.descending)
    .sortChords(d3.descending);

  var arc = d3.arc()
    .innerRadius(r0)
    .outerRadius(r0 + 20);

  var svg = d3.select("#graph svg")
    .attr("width", r1 * 2)
    .attr("height", r1 * 2);

  var g = d3.select("#graph svg")
    .attr("transform", "translate(" + (r1 + 10) + "," + (r1 + 10) + ")");

  function fade(opacity) {
    return function(g, i) {
      svg.selectAll("#graph g path.chord")
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
          console.log("iter n = " + n);
          if (!(sender in indexByName)) {
            nameByIndex[n] = sender;
            indexByName[sender] = n++;
            matrix[n - 1] = [];

          }

          receiver = publicKey(receiver);
          if (!(receiver in indexByName)) {
            console.log("new index, iter n = " + n + ",receiver = " + receiver);
            nameByIndex[n] = receiver;
            indexByName[receiver] = n++;
            matrix[n - 1] = [];

            matrix[indexByName[sender]].push(res.get('bitcoin'));
          } else {
            console.log("index already found, iter n = " + n);
            matrix[indexByName[sender]][indexByName[receiver]] = res.get('bitcoin');
          }
        });
        console.log("final matrix is " + matrix);
        var matrix_copy = [];
        for (var i = 0; i < n; i++) {
          matrix_copy[i] = Array.apply(null, Array(n)).map(Number.prototype.valueOf, 0);
        }
        for (var i = 0; i < matrix.length; i++)
          for (var j = 0; j < matrix.length; j++)
            if (matrix[i][j] != undefined) {
              matrix_copy[i][j] = matrix[i][j];
            }
        console.log("final matrix, filled with zeros, is " + matrix_copy);

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

        var colours = d3.scaleOrdinal(d3.schemeCategory20c);

        svg.selectAll("path.chord")
          .data(chord.chords)
          .enter().append("path")
          .attr("class", "chord")
          .style("stroke", function(d) {
            return d3.rgb(fill(d.source.index)).darker();
          })
          .style("fill", function(d, i) {
            return colours(i);
          })
          .attr("d", d3.svg.chord().radius(r0));
      });
  }
  draw();
}

function renderLineChart(pubKey) {
  var date = [];
  var bitcoin = [];
  var data = {
    date: {},
    value: {}
  };

  api
    .getLineChart(pubKey)
    .then(results => {
      results.records.forEach(res => {
        date.push(d3.timeParse("%Y-%m-%d")(res.date));
        bitcoin.push(res.bitcoin);
      });
      data.date = date;
      data.value = bitcoin;
    });

  // set the dimensions and margins of the graph
  var margin = {
      top: 10,
      right: 30,
      bottom: 30,
      left: 60
    },
    width = 460 - margin.left - margin.right,
    height = 400 - margin.top - margin.bottom;

  // append the svg object to the body of the page
  var svg = d3.select("#lineGraph")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform",
      "translate(" + margin.left + "," + margin.top + ")");

  // Add X axis --> it is a date format
  var x = d3.scaleTime()
    .domain(d3.extent(data, function(d) {
      return d.date;
    }))
    .range([0, width]);
  var xAxis = svg.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x));

  // Add Y axis
  var y = d3.scaleLinear()
    .domain([0, d3.max(data, function(d) {
      return +d.value;
    })])
    .range([height, 0]);
  var yAxis = svg.append("g")
    .call(d3.axisLeft(y));

  // Add a clipPath: everything out of this area won't be drawn.
  var clip = svg.append("defs").append("svg:clipPath")
    .attr("id", "clip")
    .append("svg:rect")
    .attr("width", width)
    .attr("height", height)
    .attr("x", 0)
    .attr("y", 0);

  // Add brushing
  var brush = d3.brushX() // Add the brush feature using the d3.brush function
    .extent([
      [0, 0],
      [width, height]
    ]) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
    .on("end", updateChart) // Each time the brush selection changes, trigger the 'updateChart' function

  // Create the line variable: where both the line and the brush take place
  var line = svg.append('g')
    .attr("clip-path", "url(#clip)")

  // Add the line
  line.append("path")
    .datum(data)
    .attr("class", "line")
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 1.5)
    .attr("d", d3.line()
      .x(function(d) {
        return x(d.date)
      })
      .y(function(d) {
        return y(d.value)
      })
    )

  // Add the brushing
  line
    .append("g")
    .attr("class", "brush")
    .call(brush);

  // A function that set idleTimeOut to null
  var idleTimeout

  function idled() {
    idleTimeout = null;
  }

  // A function that update the chart for given boundaries
  function updateChart() {

    // What are the selected boundaries?
    var extent = d3.event.selection

    // If no selection, back to initial coordinate. Otherwise, update X axis domain
    if (!extent) {
      if (!idleTimeout) return idleTimeout = setTimeout(idled, 350); // This allows to wait a little bit
      x.domain([4, 8])
    } else {
      x.domain([x.invert(extent[0]), x.invert(extent[1])])
      line.select(".brush").call(brush.move, null) // This remove the grey brush area as soon as the selection has been done
    }

    // Update axis and line position
    xAxis.transition().duration(1000).call(d3.axisBottom(x))
    line
      .select('.line')
      .transition()
      .duration(1000)
      .attr("d", d3.line()
        .x(function(d) {
          return x(d.date)
        })
        .y(function(d) {
          return y(d.value)
        })
      )
  }

  // If user double click, reinitialize the chart
  svg.on("dblclick", function() {
    x.domain(d3.extent(data, function(d) {
      return d.date;
    }))
    xAxis.transition().call(d3.axisBottom(x))
    line
      .select('.line')
      .transition()
      .attr("d", d3.line()
        .x(function(d) {
          return x(d.date)
        })
        .y(function(d) {
          return y(d.value)
        })
      )
  });
}
