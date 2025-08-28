import {
    SvgRenderer,
    Matrix,
    ShapeBuilder,
    ColorParser,
    parseXmlString,
    getAutoNumberingChar,
    resolveFontFamily,
    parseChart,
    parseShapeProperties,
    parseBodyProperties,
    parseParagraphProperties,
    getCellFillColor,
    getCellTextStyle,
    getCellBorders,
    buildPathStringFromGeom,
    parseSourceRectangle,
    createImage,
    resolvePath,
    getNormalizedXmlString
} from 'utils';
import {
    EMU_PER_PIXEL,
    PT_TO_PX,
    LINE_HEIGHT,
    INDENTATION_AMOUNT,
    BULLET_OFFSET,
    PML_NS, DML_NS, CHART_NS, TABLE_NS,
    slideshowProcessingActions as actions
} from 'constants';

export class PPTXHandler {
    constructor( {
        slideXml,
        slideContainer,
        masterPlaceholders,
        layoutPlaceholders,
        slideId,
        slideNum,
        slideSize,
        defaultTextStyles,
        imageMap,
        slideContext,
        finalBg,
        showMasterShapes,
        masterStaticShapes,
        layoutStaticShapes,
        slideRels,
        entriesMap,
        task
    } ) {
        this.slideXml = slideXml;
        this.slideContainer = slideContainer;
        this.masterPlaceholders = masterPlaceholders;
        this.layoutPlaceholders = layoutPlaceholders;
        this.slideId = slideId;
        this.slideNum = slideNum;
        this.slideSize = slideSize;
        this.defaultTextStyles = defaultTextStyles;
        this.imageMap = imageMap;
        this.slideContext = slideContext;
        this.finalBg = finalBg;
        this.showMasterShapes = showMasterShapes;
        this.masterStaticShapes = masterStaticShapes;
        this.layoutStaticShapes = layoutStaticShapes;
        this.slideRels = slideRels;
        this.entriesMap = entriesMap;

        this.svg = this.createSvg();
        this.renderer = new SvgRenderer( this.svg, this.slideContext );
        this.task = task;
        this.parse = this.parse.bind( this );
        this.render = this.render.bind( this );
    }

    createSvg() {
        const SVG_NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${this.slideSize.width} ${this.slideSize.height}`);
        svg.style.width = '100%';
        svg.style.height = '100%';
        this.slideContainer.appendChild(svg);
        return svg;
    }

    parse(slideshowStore) {
        this.task = 'parse';
        const xmlDoc = parseXmlString( this.slideXml, `slide number ${ this.slideNum }` );
        const hfNode = xmlDoc.getElementsByTagNameNS( PML_NS, 'hf' )[ 0 ];
        const slideLevelVisibility = {
            ftr: !hfNode || hfNode.getAttribute( 'ftr' ) !== '0',
            dt: !hfNode || hfNode.getAttribute( 'dt' ) !== '0',
            sldNum: !hfNode || hfNode.getAttribute( 'sldNum' ) !== '0',
        };
        return this;
    }

    async render() {
        this.task = 'render';
        const xmlDoc = parseXmlString(this.slideXml, `slide number ${this.slideNum}`);
        const hfNode = xmlDoc.getElementsByTagNameNS(PML_NS, 'hf')[0];
        const slideLevelVisibility = {
            ftr: !hfNode || hfNode.getAttribute('ftr') !== '0',
            dt: !hfNode || hfNode.getAttribute('dt') !== '0',
            sldNum: !hfNode || hfNode.getAttribute('sldNum') !== '0',
        };

        const listCounters = {};

        const SVG_NS = "http://www.w3.org/2000/svg";

        const defs = document.createElementNS(SVG_NS, 'defs');
        this.svg.appendChild(defs);
        this.renderer.defs = defs;

        if (this.finalBg) {
            if (this.finalBg.type === 'color') {
                const bgRect = document.createElementNS(SVG_NS, 'rect');
                bgRect.setAttribute('width', '100%');
                bgRect.setAttribute('height', '100%');
                bgRect.setAttribute('fill', this.finalBg.value);
                this.svg.insertBefore(bgRect, this.svg.firstChild);
            } else if (this.finalBg.type === 'gradient') {
                const bgRect = document.createElementNS(SVG_NS, 'rect');
                bgRect.setAttribute('width', '100%');
                bgRect.setAttribute('height', '100%');
                const gradientUrl = this.renderer._createGradient(this.finalBg);
                bgRect.setAttribute('fill', gradientUrl);
                this.svg.insertBefore(bgRect, this.svg.firstChild);
            } else if (this.finalBg.type === 'image' && this.finalBg.relId && this.imageMap[this.finalBg.relId]) {
                const bgImage = document.createElementNS(SVG_NS, 'image');
                bgImage.setAttribute('href', this.imageMap[this.finalBg.relId]);
                bgImage.setAttribute('width', this.slideSize.width);
                bgImage.setAttribute('height', this.slideSize.height);
                bgImage.setAttribute('preserveAspectRatio', 'xMidYMid slice');
                this.svg.insertBefore(bgImage, this.svg.firstChild);
            }
        }

        const initialMatrix = new Matrix();
        if (this.showMasterShapes) {
            if (this.masterStaticShapes) {
                await this.processShapeTree(this.masterStaticShapes, listCounters, initialMatrix.clone(), slideLevelVisibility);
            }
            if (this.layoutStaticShapes) {
                await this.processShapeTree(this.layoutStaticShapes, listCounters, initialMatrix.clone(), slideLevelVisibility);
            }
        }

        const spTreeNode = xmlDoc.getElementsByTagNameNS(PML_NS, 'spTree')[0];
        if (spTreeNode) {
            await this.processShapeTree(spTreeNode.children, listCounters, initialMatrix.clone(), slideLevelVisibility);
        }
    }

    async processShapeTree(elements, listCounters, parentMatrix, slideLevelVisibility = null) {
        for (const element of elements) {
            const tagName = element.localName;
            if (tagName === 'sp' || tagName === 'cxnSp') {
                await this.processShape(element, listCounters, parentMatrix, slideLevelVisibility);
            } else if (tagName === 'grpSp') {
                await this.processGroupShape(element, listCounters, parentMatrix, slideLevelVisibility);
            } else if (tagName === 'graphicFrame') {
                const graphicData = element.getElementsByTagNameNS(DML_NS, 'graphicData')[0];
                if (graphicData && graphicData.getAttribute('uri') === TABLE_NS) {
                    const tableData = await this.processTable(element, parentMatrix.clone());
                } else if (graphicData && graphicData.getAttribute('uri') === CHART_NS) {
                    const chartRelId = graphicData.getElementsByTagNameNS(CHART_NS, "chart")[0].getAttribute("r:id");
                    if (chartRelId && this.slideRels && this.slideRels[chartRelId]) {
                        const chartPath = resolvePath('ppt/slides', this.slideRels[chartRelId].target);
                        const chartXml = await getNormalizedXmlString(this.entriesMap, chartPath);
                        if (chartXml) {
                            const chartData = parseChart(chartXml);
                            if (chartData) {
                                await this.renderChart(element, chartData, parentMatrix.clone());
                            }
                        }
                    }
                }
            } else if (tagName === 'pic') {
                await this.processPicture(element, parentMatrix, slideLevelVisibility);
            }
        }
    }

    async processShape(shape, listCounters, parentMatrix, slideLevelVisibility) {
        const nvPr = shape.getElementsByTagNameNS(PML_NS, 'nvPr')[0];
        let phKey = null, phType = null;
        if (nvPr) {
            const placeholder = nvPr.getElementsByTagNameNS(PML_NS, 'ph')[0];
            if (placeholder) {
                phType = placeholder.getAttribute('type');
                const phIdx = placeholder.getAttribute('idx');
                phKey = phIdx ? `idx_${phIdx}` : phType;
                if (!phType && phIdx) {
                    phType = 'body';
                }
            }
        }

        if (slideLevelVisibility && phType && slideLevelVisibility[phType] === false) {
            return null;
        }

        const masterPh = this.masterPlaceholders ? (this.masterPlaceholders[phKey] || Object.values(this.masterPlaceholders).find(p => p.type === phType)) : null;
        const layoutPh = this.layoutPlaceholders ? this.layoutPlaceholders[phKey] : null;

        const masterShapeProps = masterPh ? masterPh.shapeProps : {};
        const layoutShapeProps = layoutPh ? layoutPh.shapeProps : {};
        const slideShapeProps = parseShapeProperties(shape, this.slideContext, this.slideNum);
        let finalFill = slideShapeProps.fill ?? layoutShapeProps.fill ?? masterShapeProps.fill;
        const finalStroke = slideShapeProps.stroke ?? layoutShapeProps.stroke ?? masterShapeProps.stroke;
        const finalEffect = slideShapeProps.effect ?? layoutShapeProps.effect ?? masterShapeProps.effect;

        if (shape.getAttribute('useBgFill') === '1') {
            if (this.finalBg && this.finalBg.type === 'color') {
                finalFill = { type: 'solid', color: this.finalBg.value };
            } else {
                finalFill = 'none'; // Or handle image backgrounds if necessary
            }
        }

        const shapeProps = {
            geometry: slideShapeProps.geometry ?? layoutShapeProps.geometry ?? masterShapeProps.geometry,
            fill: finalFill,
            stroke: finalStroke,
            effect: finalEffect,
        };

        const shapeBuilder = new ShapeBuilder(this.renderer, this.slideContext, this.imageMap, this.masterPlaceholders, this.layoutPlaceholders, EMU_PER_PIXEL, this.slideSize);

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.renderer.currentGroup.appendChild(group);
        this.renderer.currentGroup = group;

        const { pos } = shapeBuilder.build(shape, parentMatrix, shapeProps);

        if (pos) {
            const slideTxBody = shape.getElementsByTagNameNS(PML_NS, 'txBody')[0];
            let txBodyToRender = slideTxBody;

            const slideTextContent = slideTxBody ? slideTxBody.textContent.trim() : '';

            if (slideTextContent === '') {
                if (layoutPh && layoutPh.txBodyNode) {
                    txBodyToRender = layoutPh.txBodyNode;
                } else if (masterPh && masterPh.txBodyNode) {
                    txBodyToRender = masterPh.txBodyNode;
                }
            }

            if (txBodyToRender) {
                const slideBodyPr = parseBodyProperties(slideTxBody);
                const masterBodyPr = masterPh ? masterPh.bodyPr : {};
                const layoutBodyPr = layoutPh ? layoutPh.bodyPr : {};
                const finalBodyPr = { ...masterBodyPr, ...layoutBodyPr, ...slideBodyPr };
                await this.processParagraphs(
                    txBodyToRender,
                    { x: 0, y: 0, width: pos.width, height: pos.height },
                    phKey,
                    phType,
                    listCounters,
                    finalBodyPr,
                    {},
                    this.defaultTextStyles,
                    this.masterPlaceholders,
                    this.layoutPlaceholders,
                    this.imageMap
                );
            }
        }

        this.renderer.currentGroup = group.parentNode;
        return pos;
    }

    async processGroupShape(group, listCounters, parentMatrix, slideLevelVisibility) {
        if (slideLevelVisibility) {
            const placeholders = Array.from(group.getElementsByTagNameNS(PML_NS, 'ph'));
            if (placeholders.length > 0) {
                const placeholderTypes = placeholders.map(ph => ph.getAttribute('type')).filter(Boolean);
                const uniquePlaceholderTypes = [...new Set(placeholderTypes)];

                if (uniquePlaceholderTypes.length > 0 && uniquePlaceholderTypes.every(phType => slideLevelVisibility[phType] === false)) {
                    return;
                }
            }
        }

        const grpSpPrNode = group.getElementsByTagNameNS(PML_NS, 'grpSpPr')[0];
        const cNvPrNode = group.getElementsByTagNameNS(PML_NS, 'cNvPr')[0];
        const groupName = cNvPrNode ? cNvPrNode.getAttribute('name') : 'Unknown Group';

        const groupElement = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        groupElement.setAttribute('data-name', groupName);
        this.renderer.currentGroup.appendChild(groupElement);
        const originalGroup = this.renderer.currentGroup;
        this.renderer.currentGroup = groupElement;

        let finalMatrixForChildren = parentMatrix.clone();

        if (grpSpPrNode) {
            const xfrmNode = grpSpPrNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0];
            if (xfrmNode) {
                const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
                const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
                const x = offNode ? parseInt(offNode.getAttribute("x")) / EMU_PER_PIXEL : 0;
                const y = offNode ? parseInt(offNode.getAttribute("y")) / EMU_PER_PIXEL : 0;
                const w = extNode ? parseInt(extNode.getAttribute("cx")) / EMU_PER_PIXEL : 0;
                const h = extNode ? parseInt(extNode.getAttribute("cy")) / EMU_PER_PIXEL : 0;
                const rot = parseInt(xfrmNode.getAttribute('rot') || '0') / 60000;
                const flipH = xfrmNode.getAttribute('flipH') === '1';
                const flipV = xfrmNode.getAttribute('flipV') === '1';

                const chOffNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'chOff')[0];
                const chExtNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'chExt')[0];
                const chX = chOffNode ? parseInt(chOffNode.getAttribute("x")) / EMU_PER_PIXEL : 0;
                const chY = chOffNode ? parseInt(chOffNode.getAttribute("y")) / EMU_PER_PIXEL : 0;
                const chW = chExtNode ? parseInt(chExtNode.getAttribute("cx")) / EMU_PER_PIXEL : 1;
                const chH = chExtNode ? parseInt(chExtNode.getAttribute("cy")) / EMU_PER_PIXEL : 1;

                const placementMatrix = new Matrix();
                placementMatrix.translate(x, y);
                placementMatrix.translate(w / 2, h / 2);
                placementMatrix.rotate(rot * Math.PI / 180);
                placementMatrix.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                placementMatrix.translate(-w / 2, -h / 2);

                const finalGroupMatrix = parentMatrix.clone().multiply(placementMatrix);
                groupElement.setAttribute('transform', `matrix(${finalGroupMatrix.m.join(' ')})`);

                const mappingMatrix = new Matrix();
                mappingMatrix.scale(w / chW, h / chH);
                mappingMatrix.translate(-chX, -chY);

                finalMatrixForChildren = mappingMatrix;
            }
        }

        await this.processShapeTree(group.children, listCounters, finalMatrixForChildren, slideLevelVisibility);

        this.renderer.currentGroup = originalGroup;
    }

    async parsePicture( picNode, parentMatrix ) {
        const response = {}
        let localMatrix = new Matrix();
        let pos;

        const nvPicPrNode = picNode.getElementsByTagNameNS( PML_NS, 'nvPicPr' )[ 0 ];
        const nvPrNode = nvPicPrNode ? nvPicPrNode.getElementsByTagNameNS( PML_NS, 'nvPr' )[ 0 ] : null;
        const phNode = nvPrNode ? nvPrNode.getElementsByTagNameNS( PML_NS, 'ph' )[ 0 ] : null;

        if ( phNode ) {
            const phType = phNode.getAttribute( 'type' );
            if ( slideLevelVisibility && phType && slideLevelVisibility[ phType ] === false ) {
                return { width: 0, height: 0 };
            }
        }

        const spPrNode = picNode.getElementsByTagNameNS( PML_NS, 'spPr' )[ 0 ];
        const xfrmNode = spPrNode ? spPrNode.getElementsByTagNameNS( DML_NS, 'xfrm' )[ 0 ] : null;

        if ( xfrmNode ) {
            const offNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'off' )[ 0 ];
            const extNode = xfrmNode.getElementsByTagNameNS( DML_NS, 'ext' )[ 0 ];
            if ( offNode && extNode ) {
                const x = parseInt( offNode.getAttribute( "x" ) ) / EMU_PER_PIXEL;
                const y = parseInt( offNode.getAttribute( "y" ) ) / EMU_PER_PIXEL;
                const w = parseInt( extNode.getAttribute( "cx" ) ) / EMU_PER_PIXEL;
                const h = parseInt( extNode.getAttribute( "cy" ) ) / EMU_PER_PIXEL;
                const rot = parseInt( xfrmNode.getAttribute( 'rot' ) || '0' ) / 60000;
                const flipH = xfrmNode.getAttribute( 'flipH' ) === '1';
                const flipV = xfrmNode.getAttribute( 'flipV' ) === '1';

                pos = { width: w, height: h };

                localMatrix.translate( x, y );
                localMatrix.translate( w / 2, h / 2 );
                localMatrix.rotate( rot * Math.PI / 180 );
                localMatrix.scale( flipH ? -1 : 1, flipV ? -1 : 1 );
                localMatrix.translate( -w / 2, -h / 2 );
            }
        } else if ( phNode ) {
            const phType = phNode.getAttribute( 'type' );
            const phIdx = phNode.getAttribute( 'idx' );
            const phKey = phIdx ? `idx_${ phIdx }` : phType;

            const layoutPh = this.layoutPlaceholders ? this.layoutPlaceholders[ phKey ] : null;
            const masterPh = this.masterPlaceholders ? this.masterPlaceholders[ phKey ] : null;
            const placeholder = layoutPh || masterPh;

            if ( placeholder && placeholder.pos ) {
                pos = { ...placeholder.pos };
                localMatrix.translate( pos.x, pos.y );
            }
        }

        if ( !pos ) return { width: 0, height: 0 };

        const finalMatrix = parentMatrix.clone().multiply( localMatrix );

        response[ 'transform' ] = finalMatrix.m.join( ' ' );

        let placeholderProps = null;
        if ( phNode ) {
            const phType = phNode.getAttribute( 'type' );
            const phIdx = phNode.getAttribute( 'idx' );
            const phKey = phIdx ? `idx_${ phIdx }` : phType;
            const layoutPh = this.layoutPlaceholders ? this.layoutPlaceholders[ phKey ] : null;
            const masterPh = this.masterPlaceholders ? this.masterPlaceholders[ phKey ] : null;

            const masterShapeProps = masterPh ? masterPh.shapeProps : {};
            const layoutShapeProps = layoutPh ? layoutPh.shapeProps : {};

            placeholderProps = { ...masterShapeProps, ...layoutShapeProps };
        }

        const pathString = ( placeholderProps && placeholderProps.geometry )
            ? buildPathStringFromGeom( placeholderProps.geometry, pos )
            : null;

        response[ 'placeholderProps' ] = placeholderProps;

        response[ 'pathString' ] = pathString;

        const blipFillNode = picNode.getElementsByTagNameNS( PML_NS, 'blipFill' )[ 0 ];
        if ( blipFillNode ) {
            const blipNode = blipFillNode.getElementsByTagNameNS( DML_NS, 'blip' )[ 0 ];
            const relId = blipNode ? blipNode.getAttribute( 'r:embed' ) : null;
            if ( relId && this.imageMap[ relId ] ) {
                response[ 'image' ] = { href: this.imageMap[ relId ] };

                const srcRect = parseSourceRectangle( blipFillNode );
                if ( srcRect ) {
                    response[ 'image' ][ 'srcRect' ] = srcRect;
                }
            }
        }
        return response;
    }

    async processPicture(picNode, parentMatrix, slideLevelVisibility) {
		let localMatrix = new Matrix();
        let pos;

        const nvPicPrNode = picNode.getElementsByTagNameNS(PML_NS, 'nvPicPr')[0];
        const nvPrNode = nvPicPrNode ? nvPicPrNode.getElementsByTagNameNS(PML_NS, 'nvPr')[0] : null;
        const phNode = nvPrNode ? nvPrNode.getElementsByTagNameNS(PML_NS, 'ph')[0] : null;

        if (phNode) {
            const phType = phNode.getAttribute('type');
            if (slideLevelVisibility && phType && slideLevelVisibility[phType] === false) {
                return { width: 0, height: 0 };
            }
        }

        const spPrNode = picNode.getElementsByTagNameNS(PML_NS, 'spPr')[0];
        const xfrmNode = spPrNode ? spPrNode.getElementsByTagNameNS(DML_NS, 'xfrm')[0] : null;

        if (xfrmNode) {
            const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
            const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
            if (offNode && extNode) {
                const x = parseInt(offNode.getAttribute("x")) / EMU_PER_PIXEL;
                const y = parseInt(offNode.getAttribute("y")) / EMU_PER_PIXEL;
                const w = parseInt(extNode.getAttribute("cx")) / EMU_PER_PIXEL;
                const h = parseInt(extNode.getAttribute("cy")) / EMU_PER_PIXEL;
                const rot = parseInt(xfrmNode.getAttribute('rot') || '0') / 60000;
                const flipH = xfrmNode.getAttribute('flipH') === '1';
                const flipV = xfrmNode.getAttribute('flipV') === '1';

                pos = { width: w, height: h };

                localMatrix.translate(x, y);
                localMatrix.translate(w / 2, h / 2);
                localMatrix.rotate(rot * Math.PI / 180);
                localMatrix.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                localMatrix.translate(-w / 2, -h / 2);
            }
        } else if (phNode) {
            const phType = phNode.getAttribute('type');
            const phIdx = phNode.getAttribute('idx');
            const phKey = phIdx ? `idx_${phIdx}` : phType;

            const layoutPh = this.layoutPlaceholders ? this.layoutPlaceholders[phKey] : null;
            const masterPh = this.masterPlaceholders ? this.masterPlaceholders[phKey] : null;
            const placeholder = layoutPh || masterPh;

            if (placeholder && placeholder.pos) {
                pos = { ...placeholder.pos };
                localMatrix.translate(pos.x, pos.y);
            }
		}

        if (!pos) return { width: 0, height: 0 };

		const finalMatrix = parentMatrix.clone().multiply(localMatrix);

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('transform', `matrix(${finalMatrix.m.join(' ')})`);
        this.renderer.currentGroup.appendChild(group);

        const originalGroup = this.renderer.currentGroup;
        this.renderer.currentGroup = group;

        let placeholderProps = null;
        if (phNode) {
            const phType = phNode.getAttribute('type');
            const phIdx = phNode.getAttribute('idx');
            const phKey = phIdx ? `idx_${phIdx}` : phType;
            const layoutPh = this.layoutPlaceholders ? this.layoutPlaceholders[phKey] : null;
            const masterPh = this.masterPlaceholders ? this.masterPlaceholders[phKey] : null;

            const masterShapeProps = masterPh ? masterPh.shapeProps : {};
            const layoutShapeProps = layoutPh ? layoutPh.shapeProps : {};

            placeholderProps = { ...masterShapeProps, ...layoutShapeProps };
        }

        const pathString = (placeholderProps && placeholderProps.geometry)
            ? buildPathStringFromGeom(placeholderProps.geometry, pos)
			: null;

        // 1. Draw Placeholder Fill
        if ( placeholderProps?.fill?.type === 'solid' || placeholderProps?.fill?.type === 'gradient' ) {
            if ( pathString ) {
				this.renderer.drawPath( pathString, {
					fill: placeholderProps.fill.type === 'gradient'
						? placeholderProps.fill 
						: placeholderProps.fill.color 
				} );
            } else {
				this.renderer.drawRect( 0, 0, pos.width, pos.height, {
					fill: placeholderProps.fill.type === 'gradient' 
						? placeholderProps.fill 
						: placeholderProps.fill.color
				} );
            }
        }

        // 2. Draw Image
        const blipFillNode = picNode.getElementsByTagNameNS(PML_NS, 'blipFill')[0];
        if (blipFillNode) {
            const blipNode = blipFillNode.getElementsByTagNameNS(DML_NS, 'blip')[0];
            const relId = blipNode ? blipNode.getAttribute('r:embed') : null;
            if (relId && this.imageMap[relId]) {
                const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                image.setAttribute('href', this.imageMap[relId]);

                const srcRect = parseSourceRectangle(blipFillNode);
                if (srcRect) {
                    const img = await createImage(this.imageMap[relId]);
                    const naturalWidth = img.width;
                    const naturalHeight = img.height;

                    const cropLeft = naturalWidth * srcRect.l;
                    const cropTop = naturalHeight * srcRect.t;
                    const cropWidth = naturalWidth * (1 - srcRect.l - srcRect.r);
                    const cropHeight = naturalHeight * (1 - srcRect.t - srcRect.b);

                    image.setAttribute('viewBox', `${cropLeft} ${cropTop} ${cropWidth} ${cropHeight}`);
                    image.setAttribute('preserveAspectRatio', 'none');
                }

                image.setAttribute('x', 0);
                image.setAttribute('y', 0);
                image.setAttribute('width', pos.width);
                image.setAttribute('height', pos.height);

                if (pathString) {
                    const clipId = `clip-${Math.random().toString(36).slice(2, 11)}`;
                    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                    clipPath.setAttribute('id', clipId);
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', pathString);
                    clipPath.appendChild(path);
                    this.renderer.defs.appendChild(clipPath);
                    image.setAttribute('clip-path', `url(#${clipId})`);
                }

                group.appendChild(image);
            }
        }

        // 3. Draw Placeholder Stroke
        if ( placeholderProps?.stroke ) {
            if (pathString) {
                this.renderer.drawPath(pathString, { stroke: placeholderProps.stroke });
            } else {
                this.renderer.drawRect(0, 0, pos.width, pos.height, { stroke: placeholderProps.stroke });
            }
        }

        this.renderer.currentGroup = originalGroup;

        return { width: pos.width, height: pos.height };
    }

    async processTable(graphicFrame, parentMatrix) {
        const xfrmNode = graphicFrame.getElementsByTagNameNS(PML_NS, 'xfrm')[0];
        let pos = { x: 0, y: 0, width: 0, height: 0 };
        const localMatrix = new Matrix();

        if (xfrmNode) {
            const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
            const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
            if (offNode && extNode) {
                const x = parseInt(offNode.getAttribute("x")) / EMU_PER_PIXEL;
                const y = parseInt(offNode.getAttribute("y")) / EMU_PER_PIXEL;
                const w = parseInt(extNode.getAttribute("cx")) / EMU_PER_PIXEL;
                const h = parseInt(extNode.getAttribute("cy")) / EMU_PER_PIXEL;
                const rot = parseInt(xfrmNode.getAttribute('rot') || '0') / 60000;
                const flipH = xfrmNode.getAttribute('flipH') === '1';
                const flipV = xfrmNode.getAttribute('flipV') === '1';

                pos = { x: 0, y: 0, width: w, height: h }; // Position is now relative to the container

                localMatrix.translate(x, y);
                localMatrix.translate(w / 2, h / 2);
                localMatrix.rotate(rot * Math.PI / 180);
                localMatrix.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                localMatrix.translate(-w / 2, -h / 2);
            }
        }

        const finalMatrix = parentMatrix.clone().multiply(localMatrix);
        this.renderer.setTransform(finalMatrix);

        const tblNode = graphicFrame.getElementsByTagNameNS(DML_NS, 'tbl')[0];
        if (!tblNode) return {
            width: pos.width,
            height: pos.height
        };

        const tblPrNode = tblNode.getElementsByTagNameNS(DML_NS, 'tblPr')[0];

        const tableStyleIdNode = tblPrNode ? tblPrNode.getElementsByTagNameNS(DML_NS, 'tableStyleId')[0] : null;
        let styleId = tableStyleIdNode ? tableStyleIdNode.textContent : null;

        if (!styleId && this.slideContext.defaultTableStyleId) {
            styleId = `{${this.slideContext.defaultTableStyleId}}`;
        }

        const tableStyle = styleId ? this.slideContext.tableStyles[styleId] : null;

        // 2. Parse grid and column widths
        const tblGridNode = tblNode.getElementsByTagNameNS(DML_NS, 'tblGrid')[0];
        const gridColNodes = tblGridNode ? tblGridNode.getElementsByTagNameNS(DML_NS, 'gridCol') : [];
        const colWidths = Array.from(gridColNodes).map(node => parseInt(node.getAttribute('w')) / EMU_PER_PIXEL);

        // 3. Iterate through rows and cells to build a renderable grid
        const rowNodes = Array.from(tblNode.getElementsByTagNameNS(DML_NS, 'tr'));
        const numRows = rowNodes.length;
        const numCols = colWidths.length;
        if (numRows === 0 || numCols === 0) return {
            width: pos.width,
            height: pos.height
        };

        const renderedGrid = Array( numRows ).fill( 0 ).map( () => Array( numCols ).fill( false ) );

        for (let r = 0; r < numRows; r++) {
            const cellNodes = Array.from(rowNodes[r].getElementsByTagNameNS(DML_NS, 'tc'));

            for (let c = 0; c < numCols; c++) {
                if (renderedGrid[r][c]) {
                    continue; // Already handled by a previous rowspan
                }

                const cellNode = cellNodes[c];
                if (!cellNode) continue;

                const hMerge = cellNode.getAttribute('hMerge') === '1';
                const vMerge = cellNode.getAttribute('vMerge') === '1';

                if (hMerge || vMerge) {
                    continue; // Handled by the primary cell of the merge
                }

                const gridSpan = parseInt(cellNode.getAttribute('gridSpan') || '1');
                const rowSpan = parseInt(cellNode.getAttribute('rowSpan') || '1');

                // Calculate cell dimensions based on spans
                let cellWidth = 0;
                for (let i = 0; i < gridSpan; i++) {
                    if (c + i < numCols) cellWidth += colWidths[c + i];
                }

                let cellHeight = 0;
                for (let i = 0; i < rowSpan; i++) {
                    if (r + i < numRows) {
                        cellHeight += parseInt(rowNodes[r + i].getAttribute('h')) / EMU_PER_PIXEL;
                    }
                }

                // Calculate cell position
                let cellX = pos.x;
                for (let i = 0; i < c; i++) {
                    cellX += colWidths[i];
                }

                let cellY = pos.y;
                for (let i = 0; i < r; i++) {
                    cellY += parseInt(rowNodes[i].getAttribute('h')) / EMU_PER_PIXEL;
                }

                // Mark grid cells covered by this span as rendered
                for (let i = 0; i < rowSpan; i++) {
                    for (let j = 0; j < gridSpan; j++) {
                        if (r + i < numRows && c + j < numCols) {
                            renderedGrid[r + i][c + j] = true;
                        }
                    }
                }

                // Step 4: Get cell styling
                const fillColor = getCellFillColor(cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, this.slideContext);
                const textStyle = getCellTextStyle(tblPrNode, r, c, numRows, numCols, tableStyle);

                // Draw borders using a strategy to avoid double-drawing
                const borders = getCellBorders(cellNode, tblPrNode, r, c, numRows, numCols, tableStyle, this.slideContext);
                const borderDefs = {
                    top: { p: [cellX, cellY, cellX + cellWidth, cellY], draw: (r === 0) },
                    right: { p: [cellX + cellWidth, cellY, cellX + cellWidth, cellY + cellHeight], draw: true },
                    bottom: { p: [cellX + cellWidth, cellY + cellHeight, cellX, cellY + cellHeight], draw: true },
                    left: { p: [cellX, cellY + cellHeight, cellX, cellY], draw: (c === 0) },
                };

                if ( this.task === 'render' ) {
                    this.renderer.drawRect( cellX, cellY, cellWidth, cellHeight, { fill: fillColor || 'transparent' } );
                    for (const side in borderDefs) {
                        const borderStyle = borders[side];
                        if (borderStyle && borderStyle !== 'none' && borderDefs[side].draw) {
                            this.renderer.drawLine(borderDefs[side].p[0], borderDefs[side].p[1], borderDefs[side].p[2], borderDefs[side].p[3], { stroke: borderStyle });
                        }
                    }
                    await this.processCellText( cellNode, cellX, cellY, cellWidth, cellHeight, textStyle );
                }

                if ( this.task === 'parse' ) {
                    // Render text content
                    const cellText = await this.processCellText( cellNode, cellX, cellY, cellWidth, cellHeight, textStyle );
                    renderedGrid[ c ][ r ] = { cellText, textStyle, borders, borderDefs, fillColor };
                }
            }
        }

        return { tablePos: pos, grid: renderedGrid };
    }

    async processCellText(cellNode, cellX, cellY, cellWidth, cellHeight, tableTextStyle = {}) {
        const txBodyNode = cellNode.getElementsByTagNameNS(DML_NS, 'txBody')[0];
        if (!txBodyNode) return;

        const tcPrNode = cellNode.getElementsByTagNameNS(DML_NS, 'tcPr')[0];
        const bodyPrFromTxBody = parseBodyProperties(txBodyNode);

        // Default OOXML table cell margins in EMUs
        const DEFAULT_L_R_MARGIN_EMU = 91440;
        const DEFAULT_T_B_MARGIN_EMU = 45720;

        const bodyPrFromTcPr = {
            // Apply defaults first
            lIns: DEFAULT_L_R_MARGIN_EMU / EMU_PER_PIXEL,
            rIns: DEFAULT_L_R_MARGIN_EMU / EMU_PER_PIXEL,
            tIns: DEFAULT_T_B_MARGIN_EMU / EMU_PER_PIXEL,
            bIns: DEFAULT_T_B_MARGIN_EMU / EMU_PER_PIXEL,
        };

        if (tcPrNode) {
            const anchor = tcPrNode.getAttribute('anchor');
            if (anchor) bodyPrFromTcPr.anchor = anchor;

            const marL = tcPrNode.getAttribute('marL');
            if (marL) bodyPrFromTcPr.lIns = parseInt(marL) / EMU_PER_PIXEL;

            const marT = tcPrNode.getAttribute('marT');
            if (marT) bodyPrFromTcPr.tIns = parseInt(marT) / EMU_PER_PIXEL;

            const marR = tcPrNode.getAttribute('marR');
            if (marR) bodyPrFromTcPr.rIns = parseInt(marR) / EMU_PER_PIXEL;

            const marB = tcPrNode.getAttribute('marB');
            if (marB) bodyPrFromTcPr.bIns = parseInt(marB) / EMU_PER_PIXEL;
        }

        const bodyPr = { ...bodyPrFromTxBody, ...bodyPrFromTcPr };

        const pos = {
            x: cellX,
            y: cellY,
            width: cellWidth,
            height: cellHeight
        };

        const listCounters = {};
        const defaultTextStyles = { title: {}, body: {}, other: {} };
        const masterPlaceholders = {};
        const layoutPlaceholders = {};

        const paragraphs = await this.processParagraphs( txBodyNode, pos, null, 'body', listCounters, bodyPr, tableTextStyle, defaultTextStyles, masterPlaceholders, layoutPlaceholders, {} );
        if ( this.task === 'parse' ) {
            return { pos, paragraphs };
        }

        const clipId = `clip-${Math.random().toString(36).slice(2, 11)}`;
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clipPath.setAttribute('id', clipId);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', cellX);
        rect.setAttribute('y', cellY);
        rect.setAttribute('width', cellWidth);
        rect.setAttribute('height', cellHeight);
        clipPath.appendChild(rect);
        this.renderer.defs.appendChild(clipPath);

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('clip-path', `url(#${clipId})`);
        this.renderer.currentGroup.appendChild(group);
        const originalGroup = this.renderer.currentGroup;
        this.renderer.currentGroup = group;

        this.renderer.currentGroup = originalGroup;
    }

    async processParagraphs( txBody, pos, phKey, phType, listCounters, bodyPr = {}, tableTextStyle = {}, defaultTextStyles, masterPlaceholders, layoutPlaceholders ) {
        const paragraphs = Array.from( txBody.getElementsByTagNameNS( DML_NS, 'p' ) );
        if ( paragraphs.length === 0 ) return;

        const layout = this.layoutParagraphs( paragraphs, pos, phKey, phType, bodyPr, tableTextStyle, defaultTextStyles, masterPlaceholders, layoutPlaceholders );
        if ( this.task === 'parse' ) {
            return { layout, bodyPr };
        }
        const paddedPos = {
            x: pos.x + ( bodyPr.lIns || 0 ),
            y: pos.y + ( bodyPr.tIns || 0 ),
            width: pos.width - ( bodyPr.lIns || 0 ) - ( bodyPr.rIns || 0 ),
            height: pos.height - ( bodyPr.tIns || 0 ) - ( bodyPr.bIns || 0 ),
        };

        let startY = paddedPos.y;
        const anchor = bodyPr.anchor || 't';
        if ( anchor === 'ctr' ) {
            startY += ( paddedPos.height - layout.totalHeight ) / 2;
        } else if ( anchor === 'b' ) {
            startY += paddedPos.height - layout.totalHeight;
        }

        const textGroup = document.createElementNS( 'http://www.w3.org/2000/svg', 'g' );

        for ( const line of layout.lines ) {
            const finalProps = line.paragraphProps;
            const bulletOffset = ( finalProps.bullet.type && finalProps.bullet.type !== 'none' ) ? BULLET_OFFSET : 0;

            if ( bulletOffset > 0 && line.isFirstLine ) {
                const bulletColor = ColorParser.resolveColor( finalProps.bullet.color, this.slideContext ) || ColorParser.resolveColor( finalProps.defRPr.color, this.slideContext ) || '#000';
                const firstRunSize = line.runs.length > 0 ? line.runs[ 0 ].font.size : ( finalProps.defRPr.size || 18 * PT_TO_PX );
                const bulletBaselineY = startY + line.startY + firstRunSize;

                if ( finalProps.bullet.type === 'char' ) {
                    const bulletFontSize = finalProps.defRPr.size || ( 18 * PT_TO_PX );
                    const bulletText = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );
                    bulletText.setAttribute( 'x', line.x - bulletOffset );
                    bulletText.setAttribute( 'y', bulletBaselineY );
                    bulletText.setAttribute( 'fill', bulletColor );
                    bulletText.setAttribute( 'font-size', `${ bulletFontSize }px` );
                    bulletText.setAttribute( 'font-family', finalProps.bullet.font || 'Arial' );
                    bulletText.textContent = finalProps.bullet.char;
                    textGroup.appendChild( bulletText );
                } else if ( finalProps.bullet.type === 'auto' ) {
                    const level = finalProps.level || 0;
                    if ( listCounters[ level ] === undefined ) listCounters[ level ] = finalProps.bullet.startAt || 1; else listCounters[ level ]++;
                    const bulletChar = getAutoNumberingChar( finalProps.bullet.scheme, listCounters[ level ] );
                    const bulletFontSize = finalProps.defRPr.size || ( 18 * PT_TO_PX );
                    const bulletText = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );
                    bulletText.setAttribute( 'x', line.x - bulletOffset );
                    bulletText.setAttribute( 'y', bulletBaselineY );
                    bulletText.setAttribute( 'fill', bulletColor );
                    bulletText.setAttribute( 'font-size', `${ bulletFontSize }px` );
                    bulletText.setAttribute( 'font-family', finalProps.bullet.font || 'Arial' );
                    bulletText.textContent = bulletChar;
                    textGroup.appendChild( bulletText );
                } else if ( finalProps.bullet.type === 'image' && finalProps.bullet.relId && this.imageMap[ finalProps.bullet.relId ] ) {
                    const imageY = bulletBaselineY - 8; // Approximation
                    const image = document.createElementNS( 'http://www.w3.org/2000/svg', 'image' );
                    image.setAttribute( 'x', line.x - bulletOffset );
                    image.setAttribute( 'y', imageY );
                    image.setAttribute( 'width', 16 );
                    image.setAttribute( 'height', 16 );
                    image.setAttribute( 'href', this.imageMap[ finalProps.bullet.relId ] );
                    textGroup.appendChild( image );
                }
            }

            const textElement = document.createElementNS( 'http://www.w3.org/2000/svg', 'text' );
            let align = finalProps.align || 'l';
            if ( bodyPr.anchor === 'ctr' && !finalProps.align ) {
                align = 'ctr';
            }
            const xPos = line.x;

            if ( align === 'ctr' ) {
                textElement.setAttribute( 'x', xPos + line.width / 2 );
                textElement.setAttribute( 'text-anchor', 'middle' );
            } else if ( align === 'r' ) {
                textElement.setAttribute( 'x', xPos + line.width );
                textElement.setAttribute( 'text-anchor', 'end' );
            } else {
                textElement.setAttribute( 'x', xPos );
                textElement.setAttribute( 'text-anchor', 'start' );
            }
            textElement.setAttribute( 'y', startY + line.startY + ( line.runs.length > 0 ? line.runs[ 0 ].font.size : 0 ) );

            for ( const run of line.runs ) {
                const tspan = document.createElementNS( 'http://www.w3.org/2000/svg', 'tspan' );
                tspan.setAttribute( 'font-family', run.font.family );
                tspan.setAttribute( 'font-size', `${ run.font.size }px` );
                tspan.setAttribute( 'font-style', run.font.style );
                tspan.setAttribute( 'font-weight', run.font.weight );
                tspan.setAttribute( 'fill', run.color );
                tspan.textContent = run.text;
                textElement.appendChild( tspan );
            }
            textGroup.appendChild( textElement );
        }
        this.renderer.currentGroup.appendChild( textGroup );
    }

    layoutParagraphs(paragraphs, pos, phKey, phType, bodyPr, tableTextStyle = {}, defaultTextStyles, masterPlaceholders, layoutPlaceholders) {
        const paddedPos = {
            x: pos.x + ( bodyPr.lIns || 0 ),
            y: pos.y + ( bodyPr.tIns || 0 ),
            width: pos.width - ( bodyPr.lIns || 0 ) - ( bodyPr.rIns || 0 ),
            height: pos.height - ( bodyPr.tIns || 0 ) - ( bodyPr.bIns || 0 ),
        };

        const lines = [];
        let currentY = 0;

        for ( const pNode of paragraphs ) {
            const pPrNode = pNode.getElementsByTagNameNS( DML_NS, 'pPr' )[ 0 ];
            const level = pPrNode ? parseInt( pPrNode.getAttribute( 'lvl' ) || '0' ) : 0;
            let defaultStyle = defaultTextStyles.other;
            if ( phType === 'title' || phType === 'ctrTitle' || phType === 'subTitle' ) defaultStyle = defaultTextStyles.title;
            else if ( phType === 'body' ) defaultStyle = defaultTextStyles.body;

            const defaultLevelProps = ( defaultStyle && defaultStyle[ level ] ) ? defaultStyle[ level ] : {};

            const masterPh = masterPlaceholders ? ( masterPlaceholders[ phKey ] || Object.values( masterPlaceholders ).find( p => p.type === phType ) ) : null;
            let masterListStyle = ( masterPh?.listStyle?.[ level ] ) || {};
            if ( masterPh?.type && phType && masterPh.type !== phType ) {
                masterListStyle = {};
            }

            const layoutPh = layoutPlaceholders ? layoutPlaceholders[ phKey ] : null;
            let layoutListStyle = ( layoutPh?.listStyle?.[ level ] ) || {};
            if ( layoutPh?.type && phType && layoutPh.type !== phType ) {
                layoutListStyle = {};
            }
            const slideLevelProps = parseParagraphProperties( pPrNode ) || { bullet: {}, defRPr: {} };

            const finalProps = {
                level,
                ...defaultLevelProps,
                ...masterListStyle,
                ...layoutListStyle,
                ...slideLevelProps,
                bullet: { ...defaultLevelProps.bullet, ...masterListStyle.bullet, ...layoutListStyle.bullet, ...slideLevelProps.bullet },
                defRPr: { ...defaultLevelProps.defRPr, ...masterListStyle.defRPr, ...layoutListStyle.defRPr, ...slideLevelProps.defRPr, ...tableTextStyle }
            };

            const marL = ( finalProps.marL !== undefined ) ? finalProps.marL : ( level > 0 ? ( level * INDENTATION_AMOUNT ) : 0 );
            const indent = ( finalProps.indent !== undefined ) ? finalProps.indent : 0;
            const bulletOffset = ( finalProps.bullet.type && finalProps.bullet.type !== 'none' ) ? BULLET_OFFSET : 0;

            let currentLine = { runs: [], width: 0, height: 0, paragraphProps: finalProps, startY: currentY, isFirstLine: true };

            const pushCurrentLine = () => {
                if ( currentLine.runs.length > 0 ) {
                    lines.push( currentLine );
                    currentY += currentLine.height || LINE_HEIGHT;
                }
                currentLine = { runs: [], width: 0, height: 0, paragraphProps: finalProps, startY: currentY, isFirstLine: false };
            };

            const runsAndBreaks = Array.from(pNode.childNodes).filter(n => ['r', 'fld', 'br'].includes(n.localName));

            for ( const childNode of runsAndBreaks ) {
                if ( childNode.localName === 'br' ) {
                    pushCurrentLine();
                    continue;
                }

                const text = childNode.textContent;
                if (!text) continue;

                const rPr = childNode.getElementsByTagNameNS(DML_NS, 'rPr')[0];
                const finalRunProps = { ...finalProps.defRPr };
                if (rPr) {
                    if ( rPr.getAttribute( 'sz' ) ) finalRunProps.size = ( parseInt( rPr.getAttribute( 'sz' ) ) / 100 ) * PT_TO_PX;
                    if ( rPr.getAttribute( 'b' ) === '1' ) finalRunProps.bold = true; else if ( rPr.getAttribute( 'b' ) === '0' ) finalRunProps.bold = false;
                    if ( rPr.getAttribute( 'i' ) === '1' ) finalRunProps.italic = true; else if ( rPr.getAttribute( 'i' ) === '0' ) finalRunProps.italic = false;
                    const solidFill = rPr.getElementsByTagNameNS( DML_NS, 'solidFill' )[ 0 ];
                    if ( solidFill ) finalRunProps.color = ColorParser.parseColor( solidFill );
                    const latinFontNode = rPr.getElementsByTagNameNS( DML_NS, 'latin' )[ 0 ];
                    if ( latinFontNode?.getAttribute( 'typeface' ) ) finalRunProps.font = latinFontNode.getAttribute( 'typeface' );
                }

                const textColor = ColorParser.resolveColor( finalRunProps.color, this.slideContext ) || '#000000';
                let fontSize = finalRunProps.size || ( 18 * PT_TO_PX );
                if ( bodyPr.fontScale ) {
                    fontSize *= bodyPr.fontScale;
                }
                const fontStyle = finalRunProps.italic ? 'italic' : 'normal';
                const fontWeight = finalRunProps.bold ? 'bold' : 'normal';
                const fontFamily = resolveFontFamily( finalRunProps, phType, this.slideContext );

                const tempCtx = document.createElement( 'canvas' ).getContext( '2d' );
                tempCtx.font = `${ fontStyle } ${ fontWeight } ${ fontSize }px ${ fontFamily }`;
                const words = text.split( /(\s+)/ ); // Split on whitespace but keep it

                for ( const word of words ) {
                    if ( !word ) continue;

                    const wordWidth = tempCtx.measureText( word ).width;
                    const currentIndent = currentLine.isFirstLine ? marL + indent : marL;
                    const effectiveWidth = paddedPos.width - currentIndent - bulletOffset;

                    if ( currentLine.width + wordWidth > effectiveWidth && currentLine.runs.length > 0 ) {
                        pushCurrentLine();
                    }

                    currentLine.runs.push( {
                        text: word,
                        width: wordWidth,
                        font: {
                            style: fontStyle,
                            weight: fontWeight,
                            size: fontSize,
                            family: fontFamily
                        },
                        color: textColor
                    } );
                    currentLine.width += wordWidth;
                    let lineHeight = fontSize * 1.25; // Approximate height
                    if ( bodyPr.lnSpcReduction ) {
                        lineHeight *= ( 1 - bodyPr.lnSpcReduction );
                    }
                    currentLine.height = Math.max( currentLine.height, lineHeight );
                }
            }
            pushCurrentLine(); // Push the last line of the paragraph
        }

        const totalHeight = currentY;
        for ( const line of lines ) {
            const align = line.paragraphProps.align || 'l';
            const level = line.paragraphProps.level || 0;
            const marL = ( line.paragraphProps.marL !== undefined ) ? line.paragraphProps.marL : ( level > 0 ? ( level * INDENTATION_AMOUNT ) : 0 );
            const indent = ( line.paragraphProps.indent !== undefined ) ? line.paragraphProps.indent : 0;
            const bulletOffset = ( line.paragraphProps.bullet.type && line.paragraphProps.bullet.type !== 'none' ) ? BULLET_OFFSET : 0;

            const lineIndent = line.isFirstLine ? marL + indent : marL;
            const effectiveWidth = paddedPos.width - lineIndent - bulletOffset;

            let lineXOffset = 0;
            if ( align === 'ctr' ) {
                lineXOffset = ( effectiveWidth - line.width ) / 2;
            } else if ( align === 'r' ) {
                lineXOffset = effectiveWidth - line.width;
            }
            line.x = paddedPos.x + lineIndent + bulletOffset + lineXOffset;
        }

        return { totalHeight, lines };
    }

    async renderChart(graphicFrame, chartData) {
        const xfrmNode = graphicFrame.getElementsByTagNameNS(PML_NS, 'xfrm')[0];
        if (!xfrmNode) return;

        const offNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'off')[0];
        const extNode = xfrmNode.getElementsByTagNameNS(DML_NS, 'ext')[0];
        if (!offNode || !extNode) return;

        const pos = {
            x: parseInt(offNode.getAttribute("x")) / EMU_PER_PIXEL,
            y: parseInt(offNode.getAttribute("y")) / EMU_PER_PIXEL,
            width: parseInt(extNode.getAttribute("cx")) / EMU_PER_PIXEL,
            height: parseInt(extNode.getAttribute("cy")) / EMU_PER_PIXEL,
        };

        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', pos.x);
        foreignObject.setAttribute('y', pos.y);
        foreignObject.setAttribute('width', pos.width);
        foreignObject.setAttribute('height', pos.height);

        const chartContainer = document.createElement('div');
        chartContainer.style.width = `${pos.width}px`;
        chartContainer.style.height = `${pos.height}px`;

        const canvas = document.createElement('canvas');
        chartContainer.appendChild(canvas);
        foreignObject.appendChild(chartContainer);
        this.svg.appendChild(foreignObject);

        const ctx = canvas.getContext('2d');
        new Chart(ctx, {
            type: chartData.type,
            plugins: [ChartDataLabels],
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!chartData.title,
                        text: chartData.title
                    },
                    datalabels: {
                        anchor: 'center',
                        align: 'center',
                        formatter: Math.round,
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        color: '#fff'
                    }
                }
            }
        });
    }
}
