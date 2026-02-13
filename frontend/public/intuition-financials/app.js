// InTuition Exchange - Financial Seed Round Page JavaScript

// Tab Navigation
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initCharts();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to current
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Trigger chart resize for proper rendering
            window.dispatchEvent(new Event('resize'));
        });
    });
}

// Chart color palette
const colors = {
    primary: '#3b82f6',
    secondary: '#6366f1',
    success: '#10b981',
    warning: '#f59e0b',
    accent1: '#8b5cf6',
    accent2: '#ec4899',
    gradient: ['#3b82f6', '#6366f1'],
    text: '#475569',
    muted: '#94a3b8'
};

// Common chart options
const commonOptions = {
    chart: {
        fontFamily: 'Inter, sans-serif',
        toolbar: { show: false },
        animations: {
            enabled: true,
            easing: 'easeinout',
            speed: 600
        }
    },
    grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
    },
    tooltip: {
        theme: 'light',
        style: { fontSize: '13px' }
    }
};

function initCharts() {
    renderCapTableChart();
    renderGlobalMarketChart();
    renderIndiaMarketChart();
    renderCollegesUsersChart();
    renderUserSegmentChart();
    renderVolumeChart();
    renderRevenueChart();
    renderAumChart();
    renderExit3Chart();
    renderExitCompareChart();
}

// 1. Cap Table Donut Chart
function renderCapTableChart() {
    const options = {
        ...commonOptions,
        series: [75, 14.1, 4.7, 6.25],
        chart: {
            ...commonOptions.chart,
            type: 'donut',
            height: 280
        },
        labels: ['Founders', 'ESOP', 'Advisors', 'Seed Investors'],
        colors: [colors.primary, colors.secondary, colors.accent1, colors.success],
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: { fontSize: '14px' },
                        value: { 
                            fontSize: '18px',
                            fontWeight: 600,
                            formatter: val => val + '%'
                        },
                        total: {
                            show: true,
                            label: 'Total',
                            formatter: () => '100%'
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '13px'
        },
        dataLabels: { enabled: false }
    };
    
    new ApexCharts(document.querySelector('#capTableChart'), options).render();
}

// 2. Global Market Chart
function renderGlobalMarketChart() {
    const options = {
        ...commonOptions,
        series: [{
            name: 'Market Size (Billion $)',
            data: [33.4, 88.8]
        }],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 280
        },
        plotOptions: {
            bar: {
                borderRadius: 8,
                columnWidth: '55%',
                distributed: true
            }
        },
        colors: [colors.primary, colors.secondary],
        xaxis: {
            categories: ['2024', '2033'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => '$' + val + 'B'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val + 'B',
            style: { fontSize: '14px', fontWeight: 600 }
        },
        legend: { show: false }
    };
    
    new ApexCharts(document.querySelector('#globalMarketChart'), options).render();
}

// 3. India Market Chart
function renderIndiaMarketChart() {
    const options = {
        ...commonOptions,
        series: [{
            name: 'Market Size (Billion $)',
            data: [2.6, 13.9]
        }],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 280
        },
        plotOptions: {
            bar: {
                borderRadius: 8,
                columnWidth: '55%',
                distributed: true
            }
        },
        colors: [colors.success, colors.accent1],
        xaxis: {
            categories: ['2024', '2033'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => '$' + val + 'B'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val + 'B',
            style: { fontSize: '14px', fontWeight: 600 }
        },
        legend: { show: false }
    };
    
    new ApexCharts(document.querySelector('#indiaMarketChart'), options).render();
}

// 4. Colleges & Users Dual-Axis Chart
function renderCollegesUsersChart() {
    const options = {
        ...commonOptions,
        series: [
            {
                name: 'Cumulative Colleges',
                type: 'column',
                data: [100, 600, 1350]
            },
            {
                name: 'Total Active Users',
                type: 'line',
                data: [50000, 400000, 1200000]
            }
        ],
        chart: {
            ...commonOptions.chart,
            type: 'line',
            height: 320,
            stacked: false
        },
        stroke: {
            width: [0, 4],
            curve: 'smooth'
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: '50%'
            }
        },
        colors: [colors.primary, colors.success],
        fill: {
            opacity: [1, 1]
        },
        markers: {
            size: [0, 6],
            strokeWidth: 2,
            hover: { size: 8 }
        },
        xaxis: {
            categories: ['Year 1', 'Year 2', 'Year 3'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: [
            {
                title: { text: 'Colleges', style: { color: colors.primary } },
                labels: {
                    style: { colors: colors.primary },
                    formatter: val => val.toLocaleString()
                }
            },
            {
                opposite: true,
                title: { text: 'Active Users', style: { color: colors.success } },
                labels: {
                    style: { colors: colors.success },
                    formatter: val => {
                        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                        if (val >= 1000) return (val / 1000) + 'k';
                        return val;
                    }
                }
            }
        ],
        legend: {
            position: 'top',
            fontSize: '13px'
        }
    };
    
    new ApexCharts(document.querySelector('#collegesUsersChart'), options).render();
}

// 5. User Segment Stacked Bar Chart
function renderUserSegmentChart() {
    const options = {
        ...commonOptions,
        series: [
            {
                name: 'College Ecosystem Users',
                data: [30000, 240000, 675000]
            },
            {
                name: 'Open-Market Users',
                data: [20000, 160000, 525000]
            }
        ],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 300,
            stacked: true
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                horizontal: false,
                columnWidth: '55%'
            }
        },
        colors: [colors.primary, colors.secondary],
        xaxis: {
            categories: ['Year 1', 'Year 2', 'Year 3'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => {
                    if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                    if (val >= 1000) return (val / 1000) + 'k';
                    return val;
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => {
                if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                if (val >= 1000) return (val / 1000) + 'k';
                return val;
            },
            style: { fontSize: '11px' }
        },
        legend: {
            position: 'top',
            fontSize: '13px'
        }
    };
    
    new ApexCharts(document.querySelector('#userSegmentChart'), options).render();
}

// 6. Volume Chart
function renderVolumeChart() {
    const options = {
        ...commonOptions,
        series: [{
            name: 'Annual Trading Volume',
            data: [0.5, 8, 30]
        }],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 280
        },
        plotOptions: {
            bar: {
                borderRadius: 8,
                columnWidth: '60%',
                colors: {
                    ranges: [{
                        from: 0,
                        to: 100,
                        color: colors.primary
                    }]
                }
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.2,
                gradientToColors: [colors.secondary],
                opacityFrom: 1,
                opacityTo: 1
            }
        },
        colors: [colors.primary],
        xaxis: {
            categories: ['Year 1', 'Year 2', 'Year 3'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => '$' + val + 'B'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val + 'B',
            style: { fontSize: '14px', fontWeight: 600 }
        }
    };
    
    new ApexCharts(document.querySelector('#volumeChart'), options).render();
}

// 7. Revenue Chart
function renderRevenueChart() {
    const options = {
        ...commonOptions,
        series: [{
            name: 'Fee Revenue',
            data: [0.75, 12, 45]
        }],
        chart: {
            ...commonOptions.chart,
            type: 'area',
            height: 280
        },
        stroke: {
            curve: 'smooth',
            width: 3
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.5,
                opacityTo: 0.1,
                stops: [0, 90, 100]
            }
        },
        colors: [colors.success],
        markers: {
            size: 6,
            strokeWidth: 2,
            hover: { size: 8 }
        },
        xaxis: {
            categories: ['Year 1', 'Year 2', 'Year 3'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => '$' + val + 'M'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val + 'M',
            style: { fontSize: '13px', fontWeight: 600 },
            background: { enabled: true, borderRadius: 4, padding: 4 }
        }
    };
    
    new ApexCharts(document.querySelector('#revenueChart'), options).render();
}

// 8. AUM Chart
function renderAumChart() {
    const options = {
        ...commonOptions,
        series: [{
            name: 'College Token AUM',
            data: [10, 120, 540]
        }],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 280
        },
        plotOptions: {
            bar: {
                borderRadius: 8,
                columnWidth: '60%'
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'light',
                type: 'vertical',
                shadeIntensity: 0.2,
                gradientToColors: [colors.accent2],
                opacityFrom: 1,
                opacityTo: 1
            }
        },
        colors: [colors.accent1],
        xaxis: {
            categories: ['Year 1', 'Year 2', 'Year 3'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => '$' + val + 'M'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val + 'M',
            style: { fontSize: '14px', fontWeight: 600 }
        }
    };
    
    new ApexCharts(document.querySelector('#aumChart'), options).render();
}

// 9. Year-3 Exit Scenarios Chart
function renderExit3Chart() {
    const options = {
        ...commonOptions,
        series: [
            {
                name: 'Enterprise Value ($M)',
                data: [180, 360, 540]
            },
            {
                name: 'Investor Return ($M)',
                data: [11.25, 22.5, 33.75]
            }
        ],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 300
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                horizontal: false,
                columnWidth: '65%'
            }
        },
        colors: [colors.primary, colors.success],
        xaxis: {
            categories: ['Low (4×)', 'Base (8×)', 'High (12×)'],
            labels: { style: { fontSize: '13px', colors: colors.text } }
        },
        yaxis: {
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => '$' + val + 'M'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => '$' + val + 'M',
            style: { fontSize: '11px', fontWeight: 600 }
        },
        legend: {
            position: 'top',
            fontSize: '13px'
        }
    };
    
    new ApexCharts(document.querySelector('#exit3Chart'), options).render();
}

// 10. Exit Comparison Chart (3-Year vs 5-Year)
function renderExitCompareChart() {
    const options = {
        ...commonOptions,
        series: [
            {
                name: '3-Year Exit Multiple',
                data: [22.5, 45, 67.5]
            },
            {
                name: '5-Year Exit Multiple',
                data: [40, 80, 120]
            }
        ],
        chart: {
            ...commonOptions.chart,
            type: 'bar',
            height: 320
        },
        plotOptions: {
            bar: {
                borderRadius: 6,
                horizontal: false,
                columnWidth: '60%'
            }
        },
        colors: [colors.primary, colors.accent1],
        xaxis: {
            categories: ['Low (4× EV/Rev)', 'Base (8× EV/Rev)', 'High (12× EV/Rev)'],
            labels: { style: { fontSize: '12px', colors: colors.text } }
        },
        yaxis: {
            title: { text: 'Return on $500k Investment', style: { color: colors.text, fontSize: '12px' } },
            labels: {
                style: { fontSize: '12px', colors: colors.text },
                formatter: val => val + '×'
            }
        },
        dataLabels: {
            enabled: true,
            formatter: val => val + '×',
            style: { fontSize: '12px', fontWeight: 700 }
        },
        legend: {
            position: 'top',
            fontSize: '13px'
        }
    };
    
    new ApexCharts(document.querySelector('#exitCompareChart'), options).render();
}
