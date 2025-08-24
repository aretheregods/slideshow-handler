import { parseXmlString, EMU_PER_PIXEL } from 'utils';

function parseChart(chartXml) {
    const xmlDoc = parseXmlString(chartXml, "chart");
    const C_NS = "http://schemas.openxmlformats.org/drawingml/2006/chart";

    const chartData = {
        type: null,
        title: null,
        labels: [],
        datasets: []
    };

    const titleNode = xmlDoc.getElementsByTagNameNS(C_NS, 'title')[0];
    if (titleNode) {
        chartData.title = titleNode.textContent.trim();
    }

    const plotAreaNode = xmlDoc.getElementsByTagNameNS(C_NS, 'plotArea')[0];
    if (!plotAreaNode) return null;

    const chartTypeMap = {
        'barChart': 'bar',
        'lineChart': 'line',
        'pieChart': 'pie',
        'doughnutChart': 'doughnut',
        'ofPieChart': 'pie',
        // TODO: Add other chart types
    };

    let chartTypeNode;
    for (const type in chartTypeMap) {
        chartTypeNode = plotAreaNode.getElementsByTagNameNS(C_NS, type)[0];
        if (chartTypeNode) {
            chartData.type = chartTypeMap[type];
            break;
        }
    }

    if (!chartTypeNode) return null;

    const serNodes = chartTypeNode.getElementsByTagNameNS(C_NS, 'ser');
    for (const serNode of serNodes) {
        const dataset = {
            label: '',
            data: []
        };

        const txValNode = serNode.getElementsByTagNameNS(C_NS, 'tx')[0]?.getElementsByTagNameNS(C_NS, 'v')[0];
        if (txValNode) {
            dataset.label = txValNode.textContent.trim();
        }

        const catNode = serNode.getElementsByTagNameNS(C_NS, 'cat')[0];
        if (catNode) {
            const strRefNode = catNode.getElementsByTagNameNS(C_NS, 'strRef')[0];
            if (strRefNode) {
                const ptNodes = strRefNode.getElementsByTagNameNS(C_NS, 'pt');
                chartData.labels = Array.from(ptNodes).map(pt => pt.textContent.trim());
            }
        }

        const valNode = serNode.getElementsByTagNameNS(C_NS, 'val')[0];
        if (valNode) {
            const numRefNode = valNode.getElementsByTagNameNS(C_NS, 'numRef')[0];
            if (numRefNode) {
                const ptNodes = numRefNode.getElementsByTagNameNS(C_NS, 'pt');
                dataset.data = Array.from(ptNodes).map(pt => parseFloat(pt.textContent.trim()));
            }
        }

        chartData.datasets.push(dataset);
    }

    return chartData;
}

async function renderChart(graphicFrame, renderer, chartData) {
    const PML_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
    const DML_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

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

    const chartContainer = document.createElement('div');
    chartContainer.style.position = 'absolute';
    chartContainer.style.left = `${pos.x}px`;
    chartContainer.style.top = `${pos.y}px`;
    chartContainer.style.width = `${pos.width}px`;
    chartContainer.style.height = `${pos.height}px`;

    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);

    renderer.svg.parentElement.appendChild(chartContainer);


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
                    anchor: 'end',
                    align: 'end',
                    formatter: Math.round,
                    font: {
                        weight: 'bold'
                    }
                }
            }
        }
    });
}

export { parseChart, renderChart };
