/**
	enyo.ImageView is control that can display an image at a given scale
	factor, with enhanced support for double-tap/click to zoom, panning,
	mousewheel zooming and pinch-zoom (on touchscreen devices that support
	it).

		{kind:"ImageView", src:"assets/globe.jpg", scale:"auto", style:"width:500px; height:400px;"}
		
	The onload and onerror events bubble up from the underlying image element
	and an onZoom event is triggered when the user changes the zoom level of
	the image.
	
	Optionally you disable the zoom, add
	<a href="#enyo.ScrollThumb">enyo.ScrollThumb</a> indicators, disable zoom
	animation, allow panning overscroll (with a bounce back) and control the
	drag propagations, via boolean properties.
	
	Note: It's best to specify a size for the ImageView to avoid complications
*/

enyo.kind({
	name: "enyo.ImageView",
	kind: enyo.Scroller,
	//* Allows for overscrolling during panning, with a bounce back (defaults to false)
	touchOverscroll: false,
	//* Specifies if a ScrollThumb should be used to indicate scroll position/bounds (defaults to false)
	thumb: false,
	//* Whether or not double-tapping/clicking should animate it's zoom-in/out (defaults to true)
	animate: true,
	//* Allows vertical drag events, when already at the top or bottom of the pannable area, to propagate (defaults to true)
	verticalDragPropagation: true,
	//* Allows horizontal drag events, when already at the left or right of the pannable area, to propagate (defaults to true)
	horizontalDragPropagation: true,
	published: {
		/**
			Specifies the scale factor the image should be displayed at. It may be any positive numeric value or one of the following key words that will get resolved to a value dynamically:
				
			* "auto": Fits the image to the size of the ImageView
			* "width": Fits the image the width of the ImageView
			* "height": Fits the image to the height of the ImageView
		*/
		scale: "auto",
		//* Disables the zoom functionality
		disableZoom: false,
		//* The source filepath of the image to be displayed
		src: undefined
	},
	events: {
		//* Fired whenever the user adjusts the zoom of the image, via double-tapping/clicks, mousewheel, or pinch-zoom. The scale value is passed in the event data
		onZoom:""
	},
	//* @protected
	touch: true,
	preventDragPropagation: false,
	handlers: {
		ondragstart: "dragPropagation"
	},
	components:[
		{name: "animator", kind: "Animator", onStep: "zoomAnimationStep", onEnd: "zoomAnimationEnd"},
		{name:"viewport", style:"overflow:hidden;min-width:100%; min-height:100%;", ongesturechange: "gestureTransform", ongestureend: "saveState", ontap: "singleTap", ondblclick:"doubleClick", onmousewheel:"mousewheel", components:[
			{kind:"Image", ondown: "down"}
		]}
	],
	create: function() {
		this.inherited(arguments);
		this.canTransform = enyo.dom.canTransform();
		if(!this.canTransform) {
			this.$.image.applyStyle("position", "relative");
		}
		this.canAccelerate = enyo.dom.canAccelerate();
		//offscreen buffer image to get initial image dimensions
		//before displaying a scaled down image that can fit in the container
		this.bufferImage = new Image();
		this.bufferImage.onload = enyo.bind(this, "imageLoaded");
		this.bufferImage.onerror = enyo.bind(this, "imageError");
		this.srcChanged();
	},
	down: function(inSender, inEvent) {
		// Fix to prevent image drag in Firefox
		inEvent.preventDefault();
	},
	dragPropagation: function(inSender, inEvent) {
		// Propagate drag events at the edges of the image as desired by the
		// verticalDragPropagation and horizontalDragPropagation properties
		var bounds = this.getStrategy().getScrollBounds();
		var verticalEdge = ((bounds.top===0 && inEvent.dy>0) || (bounds.top>=bounds.maxTop-2 && inEvent.dy<0));
		var horizontalEdge = ((bounds.left===0 && inEvent.dx>0) || (bounds.left>=bounds.maxLeft-2 && inEvent.dx<0));
		return !((verticalEdge && this.verticalDragPropagation) || (horizontalEdge && this.horizontalDragPropagation));
	},
	mousewheel: function(inSender, inEvent) {
		inEvent.pageX |= (inEvent.clientX + inEvent.target.scrollLeft);
		inEvent.pageY |= (inEvent.clientY + inEvent.target.scrollTop);
		var zoomInc = (this.maxScale - this.minScale)/10;
		var oldScale = this.scale;
		if((inEvent.wheelDelta > 0) || (inEvent.detail < 0)) { //zoom in
			this.scale = this.limitScale(this.scale + zoomInc);
		} else if((inEvent.wheelDelta < 0) || (inEvent.detail > 0)) { //zoom out
			this.scale = this.limitScale(this.scale - zoomInc);
		}
		this.eventPt = this.calcEventLocation(inEvent);
		this.transformImage(this.scale);
		if(oldScale != this.scale) {
			this.doZoom({scale:this.scale});
		}		
		// Prevent default scroll wheel action and prevent event from bubbling up to to touch scroller
		inEvent.preventDefault();
		return true;
	},
	srcChanged: function() {
		if(this.src && this.src.length>0 && this.bufferImage && this.src!=this.bufferImage.src) {
			this.bufferImage.src = this.src;
		}
	},
	imageLoaded: function(inEvent) {
		this.originalWidth = this.bufferImage.width;
		this.originalHeight = this.bufferImage.height;
		
		//scale to fit before setting src, so unscaled image isn't visible
		this.scaleChanged();
		this.$.image.setSrc(this.bufferImage.src);
	},
	scaleChanged: function() {
		var containerNode = this.hasNode();
		if(containerNode) {
			this.containerWidth = containerNode.clientWidth;
			this.containerHeight = containerNode.clientHeight;
			var widthScale = this.containerWidth / this.originalWidth;
			var heightScale = this.containerHeight / this.originalHeight;
			this.minScale = Math.min(widthScale, heightScale);
			this.maxScale = (this.minScale*3 < 1) ? 1 : this.minScale*3;
			//resolve any keyword scale values to solid numeric values
			if(this.scale == "auto") {
				this.scale = this.minScale;
			} else if(this.scale == "width") {
				this.scale = widthScale;
			} else if(this.scale == "height") {
				this.scale = heightScale;
			} else {
				this.maxScale = Math.max(this.maxScale, this.scale);
				this.scale = this.limitScale(this.scale);
			}
		}
		this.eventPt = this.calcEventLocation();
		this.transformImage(this.scale);
	},
	imageError: function(inEvent) {
		enyo.error("Error loading image: " + this.src);
		//bubble up the error event
		this.bubble("onerror", inEvent);
	},
	gestureTransform: function(inSender, inEvent) {
		this.eventPt = this.calcEventLocation(inEvent);
		this.transformImage(this.scale * inEvent.scale);
	},
	calcEventLocation: function(inEvent) {
		//determine the target coordinates on the imageview from an event
		var eventPt = {x: 0, y:0};
		if(inEvent && this.hasNode()) {
			var rect = this.node.getBoundingClientRect();
			eventPt.x = Math.round((inEvent.pageX - rect.left) - this.imageBounds.x);
			eventPt.x = Math.max(0, Math.min(this.imageBounds.width, eventPt.x));
			eventPt.y = Math.round((inEvent.pageY - rect.top) - this.imageBounds.y);
			eventPt.y = Math.max(0, Math.min(this.imageBounds.height, eventPt.y));
		}
		return eventPt;
	},
	transformImage: function(scale) {
		this.tapped = false;
		
		var prevBounds = this.imageBounds || this.innerImageBounds(scale);
		this.imageBounds = this.innerImageBounds(scale);
		
		//style cursor if needed to indicate the image is movable
		if(this.scale>this.minScale) {
			this.$.viewport.applyStyle("cursor", "move");
		} else {
			this.$.viewport.applyStyle("cursor", null);
		}
		this.$.viewport.setBounds({width: this.imageBounds.width + "px", height: this.imageBounds.height + "px"});
		
		//determine the exact ratio where on the image was tapped
		this.ratioX = (this.eventPt.x + this.getScrollLeft()) / prevBounds.width;
		this.ratioY = (this.eventPt.y + this.getScrollTop()) / prevBounds.height;
		var scrollLeft, scrollTop;
		if(this.$.animator.ratioLock) { //locked for smartzoom
			scrollLeft = (this.$.animator.ratioLock.x * this.imageBounds.width) - (this.containerWidth / 2);
			scrollTop = (this.$.animator.ratioLock.y * this.imageBounds.height) - (this.containerHeight / 2);
		} else {
			scrollLeft = (this.ratioX * this.imageBounds.width) - (this.containerWidth / 2);
			scrollTop = (this.ratioY * this.imageBounds.height) - (this.containerHeight / 2);
		}
		scrollLeft = Math.max(0, Math.min((this.imageBounds.width - this.containerWidth), scrollLeft));
		scrollTop = Math.max(0, Math.min((this.imageBounds.height - this.containerHeight), scrollTop));
		//adjust scroller to new position that keeps ratio with the new image size
		this.setScrollLeft(scrollLeft);
		this.setScrollTop(scrollTop);
		
		if(this.canTransform) {
			var params = {scale: scale};
			// translate needs to be first, or scale and rotation will not be in the correct spot
			if(this.canAccelerate) {
				//translate3d rounded values to avoid distortion; ref: http://martinkool.com/post/27618832225/beware-of-half-pixels-in-css
				params = enyo.mixin({translate3d: Math.round(this.imageBounds.left) + "px, " + Math.round(this.imageBounds.top) + "px, 0px"}, params);
			} else {
				params = enyo.mixin({translate: this.imageBounds.left + "px, " + this.imageBounds.top + "px"}, params);
			}
			enyo.dom.transform(this.$.image, params);
		} else { //pretty much just IE8
			//use top/left and width/height to adjust
			this.$.image.setBounds({width: this.imageBounds.width + "px", height: this.imageBounds.height + "px",
					left:this.imageBounds.left + "px", top:this.imageBounds.top + "px"});
		}
		//this.stabilize();
	},
	limitScale: function(scale) {
		if(this.disableZoom) {
			scale = this.scale;
		} else if(scale > this.maxScale) {
			scale = this.maxScale;
		} else if(scale < this.minScale) {
			scale = this.minScale;
		}
		return scale;
	},
	innerImageBounds: function(scale) {
		var width = this.originalWidth * scale;
		var height = this.originalHeight * scale;
		var offset = {x:0, y:0, transX:0, transY:0};
		if(width<this.containerWidth) {
			offset.x += (this.containerWidth - width)/2;
		}
		if(height<this.containerHeight) {
			offset.y += (this.containerHeight - height)/2;
		}
		if(this.canTransform) { //adjust for the css translate, which doesn't alter image offsetWidth and offsetHeight
			offset.transX -= (this.originalWidth - width)/2;
			offset.transY -= (this.originalHeight - height)/2;
		}
		return {left:offset.x + offset.transX, top:offset.y + offset.transY, width:width, height:height, x:offset.x, y:offset.y};
	},
	saveState: function(inSender, inEvent) {
		var oldScale = this.scale;
		this.scale *= inEvent.scale;
		this.scale = this.limitScale(this.scale);
		if(oldScale != this.scale) {
			this.doZoom({scale:this.scale});
		}
	},
	doubleClick: function(inSender, inEvent) {
		//IE 8 fix; dblclick fires rather than multiple successive click events
		if(enyo.platform.ie==8) {
			this.tapped = true;
			//normalize event
			inEvent.pageX = inEvent.clientX + inEvent.target.scrollLeft;
			inEvent.pageY = inEvent.clientY + inEvent.target.scrollTop;
			this.singleTap(inSender, inEvent);
			inEvent.preventDefault();
		}
	},
	singleTap: function(inSender, inEvent) {
		setTimeout(enyo.bind(this, function() {
			this.tapped = false;
		}), 300);
		if(this.tapped) { //dbltap
			this.tapped = false;
			this.smartZoom(inSender, inEvent);
		} else {
			this.tapped = true;
		}
	},
	smartZoom: function(inSender, inEvent) {
		var containerNode = this.hasNode();
		var imgNode = this.$.image.hasNode();
		if(containerNode && imgNode && this.hasNode() && !this.disableZoom) {
			var prevScale = this.scale;
			if(this.scale!=this.minScale) { //zoom out
				this.scale = this.minScale;
			} else { //zoom in
				this.scale = this.maxScale;
			}
			this.eventPt = this.calcEventLocation(inEvent);
			if(this.animate) {
				//lock ratio position of event, and animate the scale change
				var ratioLock = {
					x: ((this.eventPt.x + this.getScrollLeft()) / this.imageBounds.width),
					y: ((this.eventPt.y + this.getScrollTop()) / this.imageBounds.height)
				};
				this.$.animator.play({
					duration:350,
					ratioLock: ratioLock,
					baseScale:prevScale,
					deltaScale:this.scale - prevScale
				});
			} else {
				this.transformImage(this.scale);
				this.doZoom({scale:this.scale});
			}
		}
	},
	zoomAnimationStep: function(inSender, inEvent) {
		var currScale = this.$.animator.baseScale + (this.$.animator.deltaScale * this.$.animator.value);
		this.transformImage(currScale);
	},
	zoomAnimationEnd: function(inSender, inEvent) {
		this.doZoom({scale:this.scale});
		this.$.animator.ratioLock = undefined;
	}
});
