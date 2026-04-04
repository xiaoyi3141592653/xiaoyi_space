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
  var userAdjustedView = false;
  var zoom = d3.zoom()
    .scaleExtent([0.2, 5])
    .on('start', function (event) {
      if (event.sourceEvent) userAdjustedView = true;
    })
    .on('zoom', function (event) {
      g.attr('transform', event.transform);
    });
  svg.call(zoom);

  // 准备数据（深拷贝以免 D3 修改原始数据）
  var nodes = data.nodes.map(function (n) { return Object.assign({}, n); });
  var links = data.links.map(function (l) { return Object.assign({}, l); });

  // Force simulation
  var simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(140))
    .force('charge', d3.forceManyBody().strength(-260))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(36));

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

  // Track drag distance to distinguish click vs drag
  var dragStart = null;
  var dragMoved = false;

  function navigateToNode(d) {
    if (d.id.charAt(0) === '#') {
      window.location.href = 'tag-' + encodeURI(d.id.substring(1)) + '.html';
    } else {
      window.location.href = encodeURI(d.id) + '.html';
    }
  }

  function getNodeRadius(d) {
    if (d.id === currentNote) return 15;
    if (d.isTag) return 8;
    return 7;
  }

  function getHoverRadius(d) {
    return getNodeRadius(d) + 1.8;
  }

  function getNodeId(v) {
    return (v && typeof v === 'object') ? v.id : v;
  }

  function collectTwoHopIds() {
    var neighbors = new Set();
    var twoHop = new Set();

    links.forEach(function (l) {
      var src = getNodeId(l.source);
      var tgt = getNodeId(l.target);
      if (src === currentNote) neighbors.add(tgt);
      if (tgt === currentNote) neighbors.add(src);
    });

    links.forEach(function (l) {
      var src = getNodeId(l.source);
      var tgt = getNodeId(l.target);
      if (neighbors.has(src) && tgt !== currentNote) twoHop.add(tgt);
      if (neighbors.has(tgt) && src !== currentNote) twoHop.add(src);
    });

    neighbors.forEach(function (id) { twoHop.add(id); });
    twoHop.add(currentNote);
    return twoHop;
  }

  function getLabelBox(d) {
    var r = getNodeRadius(d);
    var labelOffset = 10;
    var labelWidth = d._labelWidth || (String(d.id).length * 7);
    return {
      left: d.x - r - 8,
      right: d.x + labelOffset + labelWidth + 8,
      top: d.y - 14,
      bottom: d.y + 12
    };
  }

  function getSoftVisibleBox(d) {
    var r = getNodeRadius(d);
    var labelOffset = 10;
    var labelWidth = Math.min(d._labelWidth || (String(d.id).length * 7), 110);
    return {
      left: d.x - r - 10,
      right: d.x + labelOffset + labelWidth + 10,
      top: d.y - 16,
      bottom: d.y + 14
    };
  }

  function mergeBounds(acc, box) {
    if (!box) return acc;
    if (!acc) {
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom
      };
    }
    acc.left = Math.min(acc.left, box.left);
    acc.right = Math.max(acc.right, box.right);
    acc.top = Math.min(acc.top, box.top);
    acc.bottom = Math.max(acc.bottom, box.bottom);
    return acc;
  }

  // Sort nodes: tags first (bottom), normal notes, current note last (top)
  var sortedNodes = nodes.slice().sort(function (a, b) {
    var rank = function (d) {
      if (d.id === currentNote) return 2;
      if (d.isTag) return 0;
      return 1;
    };
    return rank(a) - rank(b);
  });

  // Nodes
  var node = g.append('g')
    .attr('class', 'graph-nodes')
    .selectAll('g')
    .data(sortedNodes)
    .join('g')
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', function (event, d) {
        dragStart = [event.x, event.y];
        dragMoved = false;
        dragstarted(event, d);
      })
      .on('drag', function (event, d) {
        if (dragStart) {
          var dx = event.x - dragStart[0];
          var dy = event.y - dragStart[1];
          if (Math.sqrt(dx * dx + dy * dy) > 3) dragMoved = true;
        }
        dragged(event, d);
      })
      .on('end', dragended));

  // Increase clickable area around node + label
  node.append('rect')
    .attr('x', -10)
    .attr('y', -12)
    .attr('width', function (d) { return Math.max(44, String(d.id).length * 8 + 20); })
    .attr('height', 24)
    .attr('fill', 'transparent');

  // Node circles
  node.append('circle')
    .attr('r', function (d) { return getNodeRadius(d); })
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
    .attr('font-size', function (d) { return d.id === currentNote ? '24px' : '18px'; })
    .attr('fill', function (d) {
      if (d.id === currentNote) return 'var(--graph-current)';
      return 'var(--text-muted)';
    })
    .attr('font-weight', function (d) { return d.id === currentNote ? '600' : '400'; })
    .attr('paint-order', 'stroke')
    .attr('stroke', 'var(--bg)')
    .attr('stroke-width', 2)
    .each(function (d) {
      d._labelWidth = this.getComputedTextLength();
    });

  // Hover effects
  node.on('mouseover', function (event, d) {
    d3.select(this).select('circle')
      .transition().duration(150)
      .attr('r', getHoverRadius(d));
    d3.select(this).select('text')
      .transition().duration(150)
      .attr('font-size', '22px')
      .attr('fill', 'var(--text)');
  }).on('mouseout', function (event, d) {
    d3.select(this).select('circle')
      .transition().duration(150)
      .attr('r', getNodeRadius(d));
    d3.select(this).select('text')
      .transition().duration(150)
      .attr('font-size', d.id === currentNote ? '24px' : '18px')
      .attr('fill', d.id === currentNote ? 'var(--graph-current)' : 'var(--text-muted)');
  });

  // Click to navigate (only if not dragged)
  node.on('click', function (event, d) {
    if (!dragMoved) {
      navigateToNode(d);
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
  simulation.on('end', function () {
    centerOnCurrent(true);
  });
  // Preview once during layout, but only lock after the simulation settles.
  setTimeout(function () {
    centerOnCurrent(false);
  }, 350);

  var hasCentered = false;
  function centerOnCurrent(lockFocus) {
    if (hasCentered && lockFocus !== true) return;
    if (userAdjustedView) return;
    var target = nodes.find(function (n) { return n.id === currentNote; });
    if (!target || target.x == null) return;
    var w = container.getBoundingClientRect().width || width;
    var h = container.getBoundingClientRect().height || height;

    // Collect one-hop neighbors (including current)
    var visibleNodes = nodes.filter(function (n) {
      return connectedSet.has(n.id) && n.x != null && n.y != null;
    });
    if (visibleNodes.length === 0) visibleNodes = [target];

    // Bounding box of one-hop nodes including their labels
    var allBounds = null;
    visibleNodes.forEach(function (n) {
      allBounds = mergeBounds(allBounds, getLabelBox(n));
    });

    var pad = Math.max(18, Math.min(w, h) * 0.07);
    allBounds.left -= pad;
    allBounds.right += pad;
    allBounds.top -= pad;
    allBounds.bottom += pad;

    var allW = Math.max(1, allBounds.right - allBounds.left);
    var allH = Math.max(1, allBounds.bottom - allBounds.top);
    var fitScale = Math.min(w / allW, h / allH);
    var scale = Math.min(4.8, Math.max(0.3, fitScale));

    // Center viewport on current node
    var tx = w / 2 - target.x * scale;
    var ty = h / 2 - target.y * scale;

    // Soft-clamp: keep one-hop bounding box inside viewport when possible
    var minTx = w - allBounds.right * scale;
    var maxTx = -allBounds.left * scale;
    var minTy = h - allBounds.bottom * scale;
    var maxTy = -allBounds.top * scale;
    if (minTx < maxTx) {
      tx = Math.min(maxTx, Math.max(minTx, tx));
    }
    if (minTy < maxTy) {
      ty = Math.min(maxTy, Math.max(minTy, ty));
    }

    var transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    svg.interrupt();
    if (lockFocus) {
      hasCentered = true;
      svg.transition().duration(450)
        .call(zoom.transform, transform);
      return;
    }

    svg.call(zoom.transform, transform);
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
    dragStart = null;
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
        hasCentered = false;
        userAdjustedView = false;
        setTimeout(function () {
          centerOnCurrent(false);
        }, 200);
      }
    }
  });
  resizeObserver.observe(container);

  } // end renderGraph

})();
