/* ================================================================
   graph.js — D3.js 力导向关系图谱
   显示笔记之间的 wikilink 关联关系
   ================================================================ */

(function () {
  'use strict';

  if (typeof d3 === 'undefined' || typeof GRAPH_DATA === 'undefined') return;
  var data = GRAPH_DATA;
  var currentNote = (typeof CURRENT_NOTE !== 'undefined') ? CURRENT_NOTE : '';
  if (!data.nodes || data.nodes.length === 0) return;

  // 为每个容器创建独立的图谱
  var ids = ['graph-container', 'graph-container-mobile'];
  ids.forEach(function (containerId) {
    var container = document.getElementById(containerId);
    if (!container || container.offsetParent === null && containerId === 'graph-container') {
      // skip invisible containers... but render mobile even if hidden (it becomes visible via CSS)
    }
    if (!container) return;
    renderGraph(container);
  });

  function renderGraph(container) {

  // 找出与当前笔记直接相连的节点
  var connectedSet = new Set();
  connectedSet.add(currentNote);
  data.links.forEach(function (l) {
    var src = typeof l.source === 'object' ? l.source.id : l.source;
    var tgt = typeof l.target === 'object' ? l.target.id : l.target;
    if (src === currentNote) connectedSet.add(tgt);
    if (tgt === currentNote) connectedSet.add(src);
  });

  var rect = container.getBoundingClientRect();
  var width = rect.width || 228;
  var height = rect.height || 300;

  var svg = d3.select(container)
    .append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet');

  var g = svg.append('g');

  // Zoom
  var zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on('zoom', function (event) {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  // 准备数据（深拷贝以免 D3 修改原始数据）
  var nodes = data.nodes.map(function (n) { return Object.assign({}, n); });
  var links = data.links.map(function (l) { return Object.assign({}, l); });

  // Force simulation
  var simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(60))
    .force('charge', d3.forceManyBody().strength(-120))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(20));

  // Links
  var link = g.append('g')
    .attr('class', 'graph-links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', function (d) {
      var src = typeof d.source === 'object' ? d.source.id : d.source;
      var tgt = typeof d.target === 'object' ? d.target.id : d.target;
      return (connectedSet.has(src) && connectedSet.has(tgt))
        ? 'var(--graph-node)' : 'var(--graph-link)';
    })
    .attr('stroke-width', function (d) {
      var src = typeof d.source === 'object' ? d.source.id : d.source;
      var tgt = typeof d.target === 'object' ? d.target.id : d.target;
      return (connectedSet.has(src) && connectedSet.has(tgt)) ? 1.5 : 0.8;
    })
    .attr('stroke-opacity', 0.6);

  // Track drag to distinguish click vs drag
  var dragMoved = false;

  // Nodes
  var node = g.append('g')
    .attr('class', 'graph-nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', function (event, d) { dragMoved = false; dragstarted(event, d); })
      .on('drag', function (event, d) { dragMoved = true; dragged(event, d); })
      .on('end', dragended));

  // Node circles
  node.append('circle')
    .attr('r', function (d) { return d.id === currentNote ? 7 : (d.isTag ? 5 : 4); })
    .attr('fill', function (d) {
      if (d.id === currentNote) return 'var(--graph-current)';
      if (d.isTag) return 'var(--tag-text, #0969da)';
      if (connectedSet.has(d.id)) return 'var(--graph-node)';
      return 'var(--graph-node-dim)';
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 1);

  // Node labels
  node.append('text')
    .text(function (d) { return d.id; })
    .attr('x', 10)
    .attr('y', 4)
    .attr('font-size', function (d) { return d.id === currentNote ? '11px' : '9px'; })
    .attr('fill', function (d) {
      if (d.id === currentNote) return 'var(--graph-current)';
      return 'var(--text-muted)';
    })
    .attr('font-weight', function (d) { return d.id === currentNote ? '600' : '400'; });

  // Hover effects
  node.on('mouseover', function (event, d) {
    d3.select(this).select('circle')
      .transition().duration(150)
      .attr('r', d.id === currentNote ? 9 : 6);
    d3.select(this).select('text')
      .transition().duration(150)
      .attr('font-size', '11px')
      .attr('fill', 'var(--text)');
  }).on('mouseout', function (event, d) {
    d3.select(this).select('circle')
      .transition().duration(150)
      .attr('r', d.id === currentNote ? 7 : 4);
    d3.select(this).select('text')
      .transition().duration(150)
      .attr('font-size', d.id === currentNote ? '11px' : '9px')
      .attr('fill', d.id === currentNote ? 'var(--graph-current)' : 'var(--text-muted)');
  });

  // Click to navigate (only if not dragged)
  node.on('click', function (event, d) {
    if (!dragMoved) {
      if (d.id.charAt(0) === '#') {
        window.location.href = 'tag-' + encodeURI(d.id.substring(1)) + '.html';
      } else {
        window.location.href = encodeURI(d.id) + '.html';
      }
    }
  });

  // Tooltip
  node.append('title').text(function (d) { return d.id; });

  // Simulation tick
  simulation.on('tick', function () {
    link
      .attr('x1', function (d) { return d.source.x; })
      .attr('y1', function (d) { return d.source.y; })
      .attr('x2', function (d) { return d.target.x; })
      .attr('y2', function (d) { return d.target.y; });

    node.attr('transform', function (d) {
      return 'translate(' + d.x + ',' + d.y + ')';
    });
  });

  // Center on current note after simulation settles
  simulation.on('end', centerOnCurrent);
  // Also center after a short delay in case simulation is slow
  setTimeout(centerOnCurrent, 800);

  var hasCentered = false;
  function centerOnCurrent() {
    if (hasCentered) return;
    var target = nodes.find(function (n) { return n.id === currentNote; });
    if (!target || target.x == null) return;
    hasCentered = true;
    var w = container.getBoundingClientRect().width || width;
    var h = container.getBoundingClientRect().height || height;
    var scale = 1.5;
    var tx = w / 2 - target.x * scale;
    var ty = h / 2 - target.y * scale;
    svg.transition().duration(600)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  // Drag handlers
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // 当容器大小变化时调整
  var resizeObserver = new ResizeObserver(function (entries) {
    var entry = entries[0];
    if (entry) {
      var w = entry.contentRect.width;
      var h = entry.contentRect.height;
      if (w > 0 && h > 0) {
        svg.attr('viewBox', [0, 0, w, h]);
        simulation.force('center', d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.3).restart();
      }
    }
  });
  resizeObserver.observe(container);

  } // end renderGraph

})();
