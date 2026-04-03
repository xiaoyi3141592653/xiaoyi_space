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

  var textMeasureCanvas = document.createElement('canvas');
  var textMeasureContext = textMeasureCanvas.getContext('2d');

  function getTextWidth(text, fontSize, fontWeight) {
    textMeasureContext.font = (fontWeight || 400) + ' ' + fontSize + 'px sans-serif';
    return textMeasureContext.measureText(text).width;
  }

  function wrapLabel(text, fontSize, fontWeight, maxWidth, maxLines) {
    if (!text) return [''];

    var chars = Array.from(text);
    var lines = [];
    var line = '';

    chars.forEach(function (char) {
      var next = line + char;
      if (line && getTextWidth(next, fontSize, fontWeight) > maxWidth) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    });

    if (line) lines.push(line);
    if (lines.length <= maxLines) return lines;

    var trimmed = lines.slice(0, maxLines);
    var last = trimmed[maxLines - 1];
    while (last && getTextWidth(last + '…', fontSize, fontWeight) > maxWidth) {
      last = last.slice(0, -1);
    }
    trimmed[maxLines - 1] = (last || '').replace(/\s+$/, '') + '…';
    return trimmed;
  }

  function prepareNodeMetrics(nodes, width, connectedSet) {
    nodes.forEach(function (node) {
      var isCurrent = node.id === currentNote;
      var fontSize = isCurrent ? 15 : (node.isTag ? 12 : 13);
      var fontWeight = isCurrent ? 700 : (node.isTag ? 600 : 500);
      var maxLabelWidth = isCurrent
        ? Math.max(140, Math.min(width * 0.5, 240))
        : Math.max(90, Math.min(width * 0.36, 160));
      var lines = wrapLabel(node.id, fontSize, fontWeight, maxLabelWidth, isCurrent ? 3 : 2);
      var lineHeight = fontSize + 3;
      var labelWidth = lines.reduce(function (max, line) {
        return Math.max(max, getTextWidth(line, fontSize, fontWeight));
      }, 0);

      node.isCurrent = isCurrent;
      node.isConnected = isCurrent || connectedSet.has(node.id);
      node.radius = isCurrent ? 9 : (node.isTag ? 6 : 5);
      node.fontSize = fontSize;
      node.fontWeight = fontWeight;
      node.labelLines = lines;
      node.labelLineHeight = lineHeight;
      node.labelWidth = labelWidth;
      node.labelHeight = Math.max(lineHeight, lines.length * lineHeight);
      node.labelOffsetX = node.radius + 8;
      node.collisionRadius = Math.max(
        node.radius + 10,
        node.labelOffsetX + node.labelWidth * 0.5,
        node.labelHeight * 0.65 + node.radius
      );
    });
  }

  function getFocusNodes(nodes, connectedSet) {
    return nodes.filter(function (node) {
      return node.id === currentNote || connectedSet.has(node.id);
    });
  }

  function getFocusBounds(nodes) {
    return nodes.reduce(function (bounds, node) {
      var halfHeight = Math.max(node.radius, node.labelHeight / 2);
      bounds.minX = Math.min(bounds.minX, node.x - node.radius - 18);
      bounds.maxX = Math.max(bounds.maxX, node.x + node.labelOffsetX + node.labelWidth + 18);
      bounds.minY = Math.min(bounds.minY, node.y - halfHeight - 18);
      bounds.maxY = Math.max(bounds.maxY, node.y + halfHeight + 18);
      return bounds;
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  }

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
  container.innerHTML = '';

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
  prepareNodeMetrics(nodes, width, connectedSet);

  // Force simulation
  var simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(function (d) {
      var src = typeof d.source === 'object' ? d.source.id : d.source;
      var tgt = typeof d.target === 'object' ? d.target.id : d.target;
      return (src === currentNote || tgt === currentNote) ? 96 : 76;
    }))
    .force('charge', d3.forceManyBody().strength(function (d) {
      if (d.id === currentNote) return -520;
      if (connectedSet.has(d.id)) return -300;
      return -190;
    }))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(function (d) {
      return d.collisionRadius;
    }).iterations(2))
    .force('x', d3.forceX(width / 2).strength(function (d) {
      if (d.id === currentNote) return 0.28;
      if (connectedSet.has(d.id)) return 0.12;
      return 0.04;
    }))
    .force('y', d3.forceY(height / 2).strength(function (d) {
      if (d.id === currentNote) return 0.22;
      if (connectedSet.has(d.id)) return 0.1;
      return 0.04;
    }));

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
    .attr('r', function (d) { return d.radius; })
    .attr('fill', function (d) {
      if (d.id === currentNote) return 'var(--graph-current)';
      if (d.isTag) return 'var(--tag-text, #0969da)';
      if (connectedSet.has(d.id)) return 'var(--graph-node)';
      return 'var(--graph-node-dim)';
    })
    .attr('stroke', 'var(--bg)')
    .attr('stroke-width', function (d) { return d.id === currentNote ? 2.5 : 1.5; });

  // Node labels
  node.append('text')
    .attr('class', 'graph-label')
    .attr('x', function (d) { return d.labelOffsetX; })
    .attr('y', 0)
    .attr('dominant-baseline', 'middle')
    .attr('font-size', function (d) { return d.fontSize + 'px'; })
    .attr('fill', function (d) {
      if (d.id === currentNote) return 'var(--graph-current)';
      if (connectedSet.has(d.id)) return 'var(--text)';
      return 'var(--text-muted)';
    })
    .attr('font-weight', function (d) { return d.fontWeight; })
    .each(function (d) {
      var text = d3.select(this);
      var offsetY = -((d.labelLines.length - 1) * d.labelLineHeight) / 2;
      d.labelLines.forEach(function (line, index) {
        text.append('tspan')
          .attr('x', d.labelOffsetX)
          .attr('y', offsetY + index * d.labelLineHeight)
          .text(line);
      });
    });

  // Hover effects
  node.on('mouseover', function (event, d) {
    d3.select(this).select('circle')
      .transition().duration(150)
      .attr('r', d.radius + (d.id === currentNote ? 2 : 1.5));
    d3.select(this).select('text')
      .transition().duration(150)
      .attr('fill', 'var(--text)')
      .attr('font-size', (d.fontSize + 1) + 'px')
      .attr('fill', 'var(--text)');
  }).on('mouseout', function (event, d) {
    d3.select(this).select('circle')
      .transition().duration(150)
      .attr('r', d.radius);
    d3.select(this).select('text')
      .transition().duration(150)
      .attr('font-size', d.fontSize + 'px')
      .attr('fill', d.id === currentNote
        ? 'var(--graph-current)'
        : (connectedSet.has(d.id) ? 'var(--text)' : 'var(--text-muted)'));
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
    var focusNodes = getFocusNodes(nodes, connectedSet);
    if (!focusNodes.length || focusNodes.some(function (n) { return n.x == null || n.y == null; })) return;

    var bounds = getFocusBounds(focusNodes);
    if (!isFinite(bounds.minX) || !isFinite(bounds.minY)) return;

    hasCentered = true;
    var w = container.getBoundingClientRect().width || width;
    var h = container.getBoundingClientRect().height || height;
    var padding = Math.max(24, Math.min(w, h) * 0.1);
    var boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
    var boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
    var scale = Math.min(2.2, Math.max(0.72, Math.min(
      (w - padding * 2) / boundsWidth,
      (h - padding * 2) / boundsHeight
    )));

    if (focusNodes.length <= 2) {
      scale = Math.max(scale, 1.25);
    }

    var centerX = (bounds.minX + bounds.maxX) / 2;
    var centerY = (bounds.minY + bounds.maxY) / 2;
    var tx = w / 2 - centerX * scale;
    var ty = h / 2 - centerY * scale;
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
        prepareNodeMetrics(nodes, w, connectedSet);
        simulation.force('center', d3.forceCenter(w / 2, h / 2));
        simulation.force('collision', d3.forceCollide().radius(function (d) {
          return d.collisionRadius;
        }).iterations(2));
        hasCentered = false;
        simulation.alpha(0.3).restart();
      }
    }
  });
  resizeObserver.observe(container);

  } // end renderGraph

})();
