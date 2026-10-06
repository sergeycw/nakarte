import L from 'leaflet';
import './edit_line.css';
import {wrapLatLngToTarget} from '~/lib/leaflet.fixes/fixWorldCopyJump';

L.Polyline.EditMixinOptions = {
    className: 'leaflet-editable-line'
};

L.Polyline.EditMixin = {
    _nodeMarkersZOffset: 10000,
    _historyLimit: 100,

    startEdit: function() {
        if (this._map && !this._editing) {
            this._editing = true;
            this._drawingDirection = 0;
            if (this._historyFingerprint !== this._takeSnapshot()) {
                this._undoStack = [];
                this._redoStack = [];
            }
            this.setupMarkers();
            this.on('remove', this.stopEdit.bind(this));
            this._map
                .on('click', this.onMapClick, this)
                .on('dragend', this.onMapEndDrag, this);
            L.DomEvent.on(document, 'keyup', this.onKeyPress, this);
            L.DomEvent.on(document, 'keydown', this.onKeyDownHistory, this);
            this._storedStyle = {weight: this.options.weight, opacity: this.options.opacity};
            this.setStyle({weight: 1.5, opacity: 1});
            L.DomUtil.addClass(this._map._container, 'leaflet-line-editing');
            this.fire('editstart', {target: this});
        }
    },

    stopEdit: function(userCancelled) {
        if (this._editing) {
            this.stopDrawingLine();
            this._editing = false;
            this._historyFingerprint = this._takeSnapshot();
            this.removeMarkers();
            L.DomEvent.off(document, 'keyup', this.onKeyPress, this);
            L.DomEvent.off(document, 'keydown', this.onKeyDownHistory, this);
            this.off('remove', this.stopEdit.bind(this));
            this._map
                .off('click', this.onMapClick, this)
                .off('dragend', this.onMapEndDrag, this);
            this.setStyle(this._storedStyle);
            L.DomUtil.removeClass(this._map._container, 'leaflet-line-editing');
            this.fire('editend', {target: this, userCancelled});
        }
    },

    removeMarkers: function() {
        this.getLatLngs().forEach(function(node) {
                if (node._nodeMarker) {
                    this.nodeMarkers.removeLayer(node._nodeMarker);
                    delete node._nodeMarker._lineNode;
                    delete node._nodeMarker;
                }
                if (node._segmentOverlay) {
                    this.segmentOverlays.removeLayer(node._segmentOverlay);
                    delete node._segmentOverlay._lineNode;
                    delete node._segmentOverlay;
                }
            }.bind(this)
        );
    },

    getMarkerIndex: function(marker) {
        return this.getLatLngs().indexOf(marker._lineNode);
    },

    getSegmentOverlayIndex: function(segmentOverlay) {
        return this.getLatLngs().indexOf(segmentOverlay._lineNode);
    },

    onNodeMarkerDragEnd: function(e) {
        var marker = e.target,
            nodeIndex = this.getMarkerIndex(marker),
            oldNode = this._latlngs[nodeIndex];
        this.replaceNode(nodeIndex, marker.getLatLng());
        this.rerouteAroundNode(oldNode, this._latlngs[nodeIndex]);
        this._setupEndMarkers();
    },

    onNodeMarkerDragStart: function(e) {
        if (e.target._lineNode === this._justInsertedNode) {
            this._justInsertedNode = null;
            return;
        }
        this.recordHistory();
    },

    onNodeMarkerMovedChangeNode: function(e) {
        var marker = e.target,
            latlng = marker.getLatLng(),
            node = marker._lineNode;
        node.lat = latlng.lat;
        node.lng = latlng.lng;
        this.redraw();
        this.fire('nodeschanged');
    },

    onNodeMarkerDblClickedRemoveNode: function(e) {
        if (this._disableEditOnLeftClick) {
            return;
        }
        if (this.getLatLngs().length < 2 || (this._drawingDirection && this.getLatLngs().length === 2)) {
            return;
        }
        var marker = e.target,
            nodeIndex = this.getMarkerIndex(marker);
        this.recordHistory();
        this.removeWaypoint(nodeIndex);
        this._setupEndMarkers();
    },

    onMapClick: function(e) {
        if (this._drawingDirection) {
            let newNodeIndex,
                refNodeIndex;
            if (this._drawingDirection === -1) {
                newNodeIndex = 1;
                refNodeIndex = 0;
            } else {
                newNodeIndex = this._latlngs.length - 1;
                refNodeIndex = this._latlngs.length - 1;
            }
            this.recordHistory();
            this.addNode(newNodeIndex, wrapLatLngToTarget(e.latlng, this._latlngs[refNodeIndex]));
            if (!e.originalEvent?.altKey) {
                this.routeToDrawnNode(newNodeIndex);
            }
        } else {
            if (!this.preventStopEdit) {
                this.stopEdit(true);
            }
        }
    },

    onMapEndDrag: function(e) {
        if (e.distance < 15) {
            // get mouse position from map drag handler
            var handler = e.target.dragging._draggable;
            var mousePos = handler._startPoint.add(handler._newPos).subtract(handler._startPos);
            var latlng = e.target.mouseEventToLatLng({clientX: mousePos.x, clientY: mousePos.y});
            this.onMapClick({latlng: latlng});
        }
    },

    startDrawingLine: function(direction, e) {
        if (!this._editing) {
            return;
        }
        if (direction === undefined) {
            direction = 1;
        }
        if (this._drawingDirection === direction) {
            return;
        }
        this.stopDrawingLine();
        this._drawingDirection = direction;
        if (e) {
            var newNodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length;
            this.spliceLatLngs(newNodeIndex, 0, e.latlng);
            this._setupEndMarkers();
        }

        this._map.on('mousemove', this.onMouseMoveFollowEndNode, this);
        L.DomUtil.addClass(this._map._container, 'leaflet-line-drawing');
        this._map.clickLocked = true;
    },

    stopDrawingLine: function() {
        if (!this._drawingDirection) {
            return;
        }
        this._map.off('mousemove', this.onMouseMoveFollowEndNode, this);
        var nodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length - 1;
        this.spliceLatLngs(nodeIndex, 1);
        this._drawingDirection = 0;
        L.DomUtil.removeClass(this._map._container, 'leaflet-line-drawing');
        this._map.clickLocked = false;
        this._setupEndMarkers();
        this.fire('drawend');
    },

    onKeyPress: function(e) {
        const code = e.keyCode;
        const targetTag = e.target.tagName.toLowerCase();
        const isTargetTextInput = (targetTag === 'input' && e.target.type.toLowerCase() === 'text') ||
            targetTag === 'textarea';
        if (code !== 27 && isTargetTextInput) {
            return;
        }

        switch (code) {
            case 27: // Escape
            case 13: // Enter
                if (this._drawingDirection) {
                    this.stopDrawingLine();
                } else {
                    if (!this.preventStopEdit) {
                        this.stopEdit(true);
                    }
                }
                L.DomEvent.stop(e);
                break;
            case 8: // Backspace
            case 46: // Delete
                if (this._drawingDirection && this.getLatLngs().length > 2) {
                    this.recordHistory();
                    this.removeLastDrawnWaypoint();
                    L.DomEvent.preventDefault(e);
                }
                break;

            default:
        }
    },

    onKeyDownHistory: function(e) {
        const targetTag = e.target.tagName.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea') {
            return;
        }
        const withCommand = e.ctrlKey || e.metaKey;
        const isUndo = withCommand && !e.shiftKey && e.code === 'KeyZ';
        const isRedo = withCommand && ((e.shiftKey && e.code === 'KeyZ') || (e.ctrlKey && e.code === 'KeyY'));
        if (!isUndo && !isRedo) {
            return;
        }
        L.DomEvent.stop(e);
        if (isUndo) {
            this.undo();
        } else {
            this.redo();
        }
    },

    onMouseMoveFollowEndNode: function(e) {
        var nodeIndex = this._drawingDirection === -1 ? 0 : this.getLatLngs().length - 1;
        let latlng = e.latlng;
        if (this._latlngs.length > 0) {
            latlng = wrapLatLngToTarget(latlng, this._latlngs[nodeIndex]);
        }
        this.spliceLatLngs(nodeIndex, 1, latlng);
    },

    makeNodeMarker: function(nodeIndex) {
        var node = this.getLatLngs()[nodeIndex],
            marker = L.marker(node.clone(), {
                    icon: L.divIcon({
                        className: 'line-editor-node-marker-halo' +
                            (node._routeLeg ? ' line-editor-node-marker-hidden' : ''),
                        html: '<div class="line-editor-node-marker"></div>'
                    }),
                    draggable: true,
                    zIndexOffset: this._nodeMarkersZOffset,
                    projectedShift: () => this.shiftProjectedFitMapView()
                }
            );
        marker
            .on('dragstart', this.onNodeMarkerDragStart, this)
            .on('drag', this.onNodeMarkerMovedChangeNode, this)
            // .on('dragstart', this.fire.bind(this, 'editingstart'))
            .on('dragend', this.onNodeMarkerDragEnd, this)
            .on('dblclick', this.onNodeMarkerDblClickedRemoveNode, this)
            .on('click', this.onNodeMarkerClickStartStopDrawing, this)
            .on('contextmenu', function(e) {
                    this.stopDrawingLine();
                    this.fire('noderightclick', {
                            nodeIndex: this.getMarkerIndex(marker),
                            line: this,
                            mouseEvent: e
                        }
                    );
                }, this
            );
        marker._lineNode = node;
        node._nodeMarker = marker;
        marker.addTo(this.nodeMarkers);
    },

    onNodeMarkerClickStartStopDrawing: function(e) {
        if (this._disableEditOnLeftClick) {
            return;
        }
        var marker = e.target,
            latlngs = this.getLatLngs(),
            latlngs_n = latlngs.length,
            nodeIndex = this.getMarkerIndex(marker);
        if ((this._drawingDirection === -1 && nodeIndex === 1) ||
            ((this._drawingDirection === 1 && nodeIndex === latlngs_n - 2))) {
            this.stopDrawingLine();
        } else if (nodeIndex === this.getLatLngs().length - 1) {
            this.startDrawingLine(1, e);
        } else if (nodeIndex === 0) {
            this.startDrawingLine(-1, e);
        }
    },

    makeSegmentOverlay: function(nodeIndex) {
        const latlngs = this.getLatLngs(),
            p1 = latlngs[nodeIndex],
            p2 = latlngs[nodeIndex + 1];
        if (!p2) {
            return;
        }
        const segmentOverlay = L.polyline([p1, p2], {
            weight: 10,
            opacity: 0.0,
            projectedShift: () => this.shiftProjectedFitMapView()
        });
        segmentOverlay.on('mousedown', this.onSegmentMouseDownAddNode, this);
        segmentOverlay.on('contextmenu', function(e) {
                this.stopDrawingLine();
                this.fire('segmentrightclick', {
                        nodeIndex: this.getSegmentOverlayIndex(segmentOverlay),
                        mouseEvent: e,
                        line: this
                    }
                );
            }, this
        );
        segmentOverlay._lineNode = p1;
        p1._segmentOverlay = segmentOverlay;
        segmentOverlay.addTo(this.segmentOverlays);
    },

    onSegmentMouseDownAddNode: function(e) {
        if (e.originalEvent.button !== 0 || this._disableEditOnLeftClick) {
            return;
        }
        var segmentOverlay = e.target,
            latlngs = this.getLatLngs(),
            nodeIndex = this.getSegmentOverlayIndex(segmentOverlay) + 1;
        const midPoint = L.latLngBounds(latlngs[nodeIndex], latlngs[nodeIndex - 1]).getCenter();
        this.recordHistory();
        this.addNode(nodeIndex, wrapLatLngToTarget(e.latlng, midPoint));
        this._justInsertedNode = latlngs[nodeIndex];
        if (L.Draggable._dragging) {
            L.Draggable._dragging.finishDrag();
        }
        latlngs[nodeIndex]._nodeMarker.dragging._draggable._onDown(e.originalEvent);
    },

    addNode: function(index, latlng, routeLeg) {
        var nodes = this.getLatLngs(),
            isAddingLeft = (index === 1 && this._drawingDirection === -1),
            isAddingRight = (index === nodes.length - 1 && this._drawingDirection === 1);
        latlng = latlng.clone();
        if (routeLeg) {
            latlng._routeLeg = routeLeg;
        }
        this.spliceLatLngs(index, 0, latlng);
        this.makeNodeMarker(index);
        if (!isAddingLeft && (index >= 1)) {
            if (!isAddingRight) {
                var prevNode = nodes[index - 1];
                this.segmentOverlays.removeLayer(prevNode._segmentOverlay);
                delete prevNode._segmentOverlay._lineNode;
                delete prevNode._segmentOverlay;
            }
            this.makeSegmentOverlay(index - 1);
        }
        if (!isAddingRight) {
            this.makeSegmentOverlay(index);
        }
        if (nodes.length < 3) {
            this._setupEndMarkers();
        }
    },

    _takeSnapshot: function() {
        const [first, last] = this._fixedNodesRange();
        const nodes = this._latlngs.slice(first, last + 1);
        const pending = (this._pendingLegs ?? [])
            .map((leg) => [nodes.indexOf(leg.start), nodes.indexOf(leg.end), leg.activityId])
            .filter(([i, j]) => i >= 0 && j > i);
        return JSON.stringify({
            nodes: nodes.map((node) => {
                if (!node._routeLeg) {
                    return [node.lat, node.lng];
                }
                return [node.lat, node.lng, node._routeLeg.activityId];
            }),
            pending,
        });
    },

    _restoreSnapshot: function(snapshot) {
        const {nodes: storedNodes, pending} = JSON.parse(snapshot);
        for (const leg of this._pendingLegs ?? []) {
            leg.cancelled = true;
        }
        this._pendingLegs = [];
        this._updateRoutingCursor();
        let leg = null;
        const nodes = storedNodes.map(([lat, lng, activityId]) => {
            const node = L.latLng(lat, lng);
            if (!activityId) {
                leg = null;
                return node;
            }
            if (!leg) {
                leg = {activityId, cancelled: false};
            }
            node._routeLeg = leg;
            return node;
        });
        const offset = this._drawingDirection === -1 ? 1 : 0;
        if (this._drawingDirection === 1) {
            nodes.push(this._latlngs[this._latlngs.length - 1]);
        } else if (this._drawingDirection === -1) {
            nodes.unshift(this._latlngs[0]);
        }
        this.removeMarkers();
        this.setLatLngs(nodes);
        this.setupMarkers();
        this.fire('nodeschanged');
        for (const [i, j, activityId] of pending) {
            this.routeBetween(nodes[i + offset], nodes[j + offset], activityId);
        }
    },

    recordHistory: function() {
        if (!this._editing) {
            return;
        }
        this._justInsertedNode = null;
        const snapshot = this._takeSnapshot();
        if (this._undoStack[this._undoStack.length - 1] === snapshot) {
            return;
        }
        this._undoStack.push(snapshot);
        if (this._undoStack.length > this._historyLimit) {
            this._undoStack.shift();
        }
        this._redoStack = [];
    },

    undo: function() {
        if (!this._editing || !this._undoStack.length) {
            return;
        }
        this._redoStack.push(this._takeSnapshot());
        this._restoreSnapshot(this._undoStack.pop());
    },

    redo: function() {
        if (!this._editing || !this._redoStack.length) {
            return;
        }
        this._undoStack.push(this._takeSnapshot());
        this._restoreSnapshot(this._redoStack.pop());
    },

    _fixedNodesRange: function() {
        const first = this._drawingDirection === -1 ? 1 : 0;
        const last = this._drawingDirection === 1 ? this._latlngs.length - 2 : this._latlngs.length - 1;
        return [first, last];
    },

    _findAdjacentWaypoint: function(index, step) {
        const [first, last] = this._fixedNodesRange();
        let i = index + step;
        while (i >= first && i <= last && this._latlngs[i]._routeLeg) {
            i += step;
        }
        if (i < first || i > last) {
            return null;
        }
        return {node: this._latlngs[i], leg: this._latlngs[index + step]._routeLeg ?? null};
    },

    _updateRoutingCursor: function() {
        if (!this._map) {
            return;
        }
        const pending = this._pendingLegs?.length > 0;
        L.DomUtil[pending ? 'addClass' : 'removeClass'](this._map._container, 'leaflet-line-routing');
    },

    _removeNodesBetween: function(start, end) {
        const i = this._latlngs.indexOf(start);
        for (let k = this._latlngs.indexOf(end) - 1; k > i; k--) {
            if (this._latlngs[k]._nodeMarker) {
                this.removeNode(k);
            } else {
                this.spliceLatLngs(k, 1);
            }
        }
    },

    _insertLegNode: function(index, latlng, leg) {
        if (this._editing) {
            this.addNode(index, latlng, leg);
            return;
        }
        const node = latlng.clone();
        node._routeLeg = leg;
        this.spliceLatLngs(index, 0, node);
    },

    routeBetween: function(start, end, activityId) {
        if (!this.router) {
            return;
        }
        const leg = {start, end, activityId, cancelled: false};
        const i = this._latlngs.indexOf(start);
        const j = this._latlngs.indexOf(end);
        for (let k = i + 1; k < j; k++) {
            this._latlngs[k]._routeLeg = leg;
        }
        this._pendingLegs = [...(this._pendingLegs ?? []), leg];
        this._updateRoutingCursor();
        this.router
            .route(start, end, activityId)
            .catch(() => [])
            .then((nodes) => this._applyLegRoute(leg, nodes));
    },

    _applyLegRoute: function(leg, nodes) {
        this._pendingLegs = this._pendingLegs.filter((pending) => pending !== leg);
        this._updateRoutingCursor();
        if (leg.cancelled || !this._map) {
            return;
        }
        const i = this._latlngs.indexOf(leg.start);
        const j = this._latlngs.indexOf(leg.end);
        if (i < 0 || j <= i) {
            return;
        }
        for (let k = i + 1; k < j; k++) {
            if (this._latlngs[k]._routeLeg !== leg) {
                return;
            }
        }
        this._removeNodesBetween(leg.start, leg.end);
        nodes.forEach((node, n) => this._insertLegNode(i + 1 + n, node, leg));
        if (!this._editing) {
            this._historyFingerprint = this._takeSnapshot();
        }
    },

    _cancelPendingLegsAt: function(node) {
        const cancelled = (this._pendingLegs ?? []).filter((leg) => leg.start === node || leg.end === node);
        for (const leg of cancelled) {
            leg.cancelled = true;
        }
        return cancelled;
    },

    routeToDrawnNode: function(index) {
        const activityId = this.router?.activityId();
        if (!activityId) {
            return;
        }
        const anchorIndex = index - this._drawingDirection;
        const [first, last] = this._fixedNodesRange();
        if (anchorIndex < first || anchorIndex > last) {
            return;
        }
        const node = this._latlngs[index];
        const anchor = this._latlngs[anchorIndex];
        if (this._drawingDirection === 1) {
            this.routeBetween(anchor, node, activityId);
        } else {
            this.routeBetween(node, anchor, activityId);
        }
    },

    rerouteAroundNode: function(oldNode, node) {
        const index = this._latlngs.indexOf(node);
        const pendingLegs = this._cancelPendingLegsAt(oldNode);
        const prev = this._findAdjacentWaypoint(index, -1);
        const next = this._findAdjacentWaypoint(index, 1);
        const pendingBefore = pendingLegs.find((leg) => leg.end === oldNode);
        const pendingAfter = pendingLegs.find((leg) => leg.start === oldNode);
        const activityBefore = prev?.leg?.activityId ?? pendingBefore?.activityId;
        const activityAfter = next?.leg?.activityId ?? pendingAfter?.activityId;
        if (prev && activityBefore) {
            this.routeBetween(prev.node, node, activityBefore);
        }
        if (next && activityAfter) {
            this.routeBetween(node, next.node, activityAfter);
        }
    },

    removeWaypoint: function(index) {
        const node = this._latlngs[index];
        const pendingLegs = this._cancelPendingLegsAt(node);
        const prev = this._findAdjacentWaypoint(index, -1);
        const next = this._findAdjacentWaypoint(index, 1);
        const activityId = prev?.leg?.activityId ?? next?.leg?.activityId ?? pendingLegs[0]?.activityId;
        if (prev?.leg) {
            this._removeNodesBetween(prev.node, node);
        }
        if (next?.leg) {
            this._removeNodesBetween(node, next.node);
        }
        this.removeNode(this._latlngs.indexOf(node));
        if (prev && next && activityId) {
            this.routeBetween(prev.node, next.node, activityId);
        }
    },

    removeLastDrawnWaypoint: function() {
        const lastFixedIndex = () => (this._drawingDirection === 1 ? this._latlngs.length - 2 : 1);
        this._cancelPendingLegsAt(this._latlngs[lastFixedIndex()]);
        this.removeNode(lastFixedIndex());
        while (this._latlngs.length > 2 && this._latlngs[lastFixedIndex()]._routeLeg) {
            this.removeNode(lastFixedIndex());
        }
    },

    removeNode: function(index) {
        var nodes = this.getLatLngs(),
            node = nodes[index],
            marker = node._nodeMarker;
        delete node._nodeMarker;
        delete marker._lineNode;
        this.spliceLatLngs(index, 1);
        this.nodeMarkers.removeLayer(marker);
        if (node._segmentOverlay) {
            this.segmentOverlays.removeLayer(node._segmentOverlay);
            delete node._segmentOverlay._lineNode;
            delete node._segmentOverlay;
        }
        var prevNode = nodes[index - 1];
        if (prevNode && prevNode._segmentOverlay) {
            this.segmentOverlays.removeLayer(prevNode._segmentOverlay);
            delete prevNode._segmentOverlay._lineNode;
            delete prevNode._segmentOverlay;
            if ((index < nodes.length - 1) || (index < nodes.length && this._drawingDirection !== 1)) {
                this.makeSegmentOverlay(index - 1);
            }
        }
    },

    replaceNode: function(index, latlng) {
        var nodes = this.getLatLngs(),
            oldNode = nodes[index],
            oldMarker = oldNode._nodeMarker;
        this.nodeMarkers.removeLayer(oldNode._nodeMarker);
        delete oldNode._nodeMarker;
        delete oldMarker._lineNode;
        latlng = latlng.clone();
        this.spliceLatLngs(index, 1, latlng);
        this.makeNodeMarker(index);
        if (oldNode._segmentOverlay) {
            this.segmentOverlays.removeLayer(oldNode._segmentOverlay);
            delete oldNode._segmentOverlay._lineNode;
            delete oldNode._segmentOverlay;
            this.makeSegmentOverlay(index);
        }
        var prevNode = nodes[index - 1];
        if (prevNode && prevNode._segmentOverlay) {
            this.segmentOverlays.removeLayer(prevNode._segmentOverlay);
            delete prevNode._segmentOverlay._lineNode;
            delete prevNode._segmentOverlay;
            this.makeSegmentOverlay(index - 1);
        }
    },

    _setupEndMarkers: function() {
        const nodesCount = this._latlngs.length;
        if (nodesCount === 0) {
            return;
        }
        const startIndex = this._drawingDirection === -1 ? 1 : 0;
        const endIndex = this._drawingDirection === 1 ? nodesCount - 2 : nodesCount - 1;
        for (const index of [startIndex, endIndex]) {
            const node = this._latlngs[index];
            if (node?._routeLeg) {
                delete node._routeLeg;
                L.DomUtil.removeClass(node._nodeMarker._icon, 'line-editor-node-marker-hidden');
            }
        }
        const startIcon = this._latlngs[startIndex]._nodeMarker?._icon;
        if (!startIcon) {
            return;
        }
        L.DomUtil[this._drawingDirection === -1 ? 'removeClass' : 'addClass'](
            startIcon, 'line-editor-node-marker-start'
        );
        if (endIndex >= 0) {
            const endIcon = this._latlngs[endIndex]._nodeMarker._icon;
            let func;
            if (this._drawingDirection !== 1 && endIndex > 0) {
                func = L.DomUtil.addClass;
            } else {
                func = L.DomUtil.removeClass;
            }
            func(endIcon, 'line-editor-node-marker-end');
        }
    },

    setupMarkers: function() {
        if (!this.segmentOverlays) {
            this.segmentOverlays = L.featureGroup().addTo(this._map);
        }
        if (!this.nodeMarkers) {
            this.nodeMarkers = L.featureGroup().addTo(this._map);
        }
        this.removeMarkers();
        var latlngs = this.getLatLngs(),
            startNode = 0,
            endNode = latlngs.length - 1;
        if (this._drawingDirection === -1) {
            startNode += 1;
        }
        if (this._drawingDirection === 1) {
            endNode -= 1;
        }
        for (var i = startNode; i <= endNode; i++) {
            this.makeNodeMarker(i);
            if (i < endNode) {
                this.makeSegmentOverlay(i);
            }
        }
        this._setupEndMarkers();
    },

    spliceLatLngs: function(...args) {
        const latlngs = this.getLatLngs();
        const res = latlngs.splice(...args);
        this.setLatLngs(latlngs);
        this.fire('nodeschanged');
        return res;
        // this._latlngs.splice(...args);
        // this.redraw();
    },

    getFixedLatLngs: function() {
        const start = this._drawingDirection === -1 ? 1 : 0;
        let end = this._latlngs.length;
        if (this._drawingDirection === 1) {
            end -= 1;
        }
        return this._latlngs.slice(start, end);
    },

    disableEditOnLeftClick: function(disable) {
        this._disableEditOnLeftClick = disable;
    },

    highlighNodesForDeletion: function(startNodeIndex, endNodeIndex) {
        if (!this._editing) {
            return;
        }
        const nodes = this.getLatLngs();
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const icon = node._nodeMarker._icon;
            L.DomUtil[i >= startNodeIndex && i <= endNodeIndex ? 'addClass' : 'removeClass'](icon, 'highlight-delete');
        }
    }
};
