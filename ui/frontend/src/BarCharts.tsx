import './App.css';
import logo from './assets/clp-logo.png';
import {
    useEffect,
    useState,
} from 'react';
import {
    Box,
    Chip,
    Link,
    Typography
} from '@mui/joy';
import { BarChart, BarLabel, BarLabelProps } from '@mui/x-charts/BarChart';

import Divider, { dividerClasses } from '@mui/material/Divider';

const TYPE = ['', 'unstructured', 'semiStructured'];
const METRIC = ['', 'hotRun', 'coldRun'];

type BenchmarkingResultBasic<T> = {
    [type: string]: {
        [metric: string]: T;
    };
}
function BenchmarkingResultBasicInitializer<T>(cb: (type: string, metric: string) => T) {
    return TYPE.reduce((typeAcc, type) => {
        if (type) {
            typeAcc[type] = METRIC.reduce((metricAcc, metric) => {
                if (metric) {
                    metricAcc[metric] = cb(type, metric);
                }
                return metricAcc;
            }, {} as {
                [metric: string]: T;
            })
        }
        return typeAcc;
    }, {} as BenchmarkingResultBasic<T>);
}

const BENCHMARK_WORKLOAD: BenchmarkingResultBasic<{
    name: string;
    size: number;
}> = BenchmarkingResultBasicInitializer((type, _) => {
    if (TYPE[1] == type) {
        return {
            name: 'Hadoop (258GB)',
            size: 276224164352,
        };
    } else if (TYPE[2] == type) {
        return { 
            name: 'MongoDB (64GB)',
            size: 69582861765,
        };
    }
    return { 
        name: 'ERROR',
        size: 0,
    };
})

type BenchmarkingResultResponse = {
    message: string;
    payload: {
        target: string;
        target_displayed_name: string,
        displayed_order: number,
        is_enable: boolean,
        type: number;
        metric: number;
        ingest_time: number;
        compressed_size: number;
        avg_ingest_mem: number;
        avg_query_mem: number;
        query_times: string;
    }[];
};

const getSeriesLabel = (metric: string) => {
    switch (metric) {
        case 'compressionRatio':
            return 'Compression Ratio (Original Size / Compressed Size)';
        case 'ingestion_speed':
            return 'Ingestion Speed (MB/s)';
        case 'avg_ingest_mem':
            return 'Average Ingestion Memory Efficiency (Max Target Usage/Selected Target Usage)';
        case 'avg_query_mem':
            return 'Average Search Memory Efficiency (Max Target Usage/Selected Target Usage)';
        case 'avg_query_time':
            return 'Average Query Time Efficiency (Max Target Search Latency/Selected Target Search Latency)';
        case 'query_times':
            return 'Individual Query Efficiency (Max Target Search Latency/Selected Target Search Latency)';
        default:
            return metric.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }
};

const getBarLabel = (metric: string, value: number) => {
    switch (metric) {
        case 'ingestion_speed':
            return value.toFixed(2) + 'MB/s';
        case 'compressionRatio':
        case 'avg_ingest_mem':
        case 'avg_query_mem':
        case 'avg_query_time':
        case 'query_times':
            return value.toFixed(2) + 'x';
        default:
            return value.toFixed(2);
    }
};

const BarCharts = () => {
    const colorMapping = {
    'CLP': '#00C7BD',          // YScope - Bright Teal
    'CLP-S': '#00C7BD',        // YScope - Bright Teal
    'Splunk': '#E20082',       // Splunk - Pink
    'Elasticsearch': '#008EC2', // Elasticsearch - Blue
    'Loki': '#A4A4A4',         // Loki - Gray
    'grep': '#2DE109',         // Grep - Green
    'ClickHouse': '#F0B400',   // Clickhouse - Dark Yellow
    'ClickHouse (JSON)': '#FFDD1A', // Clickhouse JSON - Bright Yellow
    'MongoDB': '#008535',      // MongoDB - Green
    'OpenObserve': '#8A14FF',  // OpenObserve - Purple
    'OpenObserve (w/ LIMIT)': '#BD7AFF', // OpenObserve with Limit - Light Purple
};
    const [type, setType] = useState(TYPE[1]);
    const [metric, setMetric] = useState(METRIC[1]);
    const [benchmarkWorkload, setBenchmarkWorkload] = useState<string>();
    const [loading, setLoading] = useState(true);
    const [chartData, setChartData] = useState<{ target: string; value: number }[]>([]);
    const [selectedMetric, setSelectedMetric] = useState('compressionRatio');
    const [selectedQuery, setSelectedQuery] = useState(0);
    const [allTargets, setAllTargets] = useState<string[]>([]);
    const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
    const [barColors, setBarColors] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`api/get`);
                const result: BenchmarkingResultResponse = await response.json();
                const benchmarkSize = BENCHMARK_WORKLOAD[type][metric].size/ 1024 / 1024; // Convert to MB
                setBenchmarkWorkload(BENCHMARK_WORKLOAD[type][metric].name);

                const data = result.payload
                    .filter(item => item.type === TYPE.indexOf(type) && item.metric === METRIC.indexOf(metric) && item.is_enable)
                    .map(item => {
                        const target = item.target_displayed_name;
                        let value;

                        // Determine the value based on the selected metric
                        switch (selectedMetric) {
                            case 'compressionRatio':
                                if( item.compressed_size === 0) {
                                    value = 0;
                                    break;
                                }
                                value = benchmarkSize ? (benchmarkSize/ (item.compressed_size/1024/1024)) : 0;
                                break;
                            case 'ingestion_speed':
                                console.log('Ingestion Time:', item.ingest_time);
                                if( item.ingest_time === 0) {
                                    value = 0;
                                    break;
                                }
                                value = benchmarkSize ? (benchmarkSize/ (item.ingest_time/1000)) : 0;
                                break;
                            case 'avg_ingest_mem':
                                value = item.avg_ingest_mem/1024/1024;
                                break;
                            case 'avg_query_mem':
                                value = item.avg_query_mem/1024/1024;
                                break;
                            case 'avg_query_time':
                                //calculate average query time
                                const queryTimeString = item.query_times.slice(1, -1);
                                const queryTimes = queryTimeString ? queryTimeString.split(',').map(Number) : [];
                                console.log('Query Times:', queryTimes);
                                if (queryTimes.length === 0) {
                                    value = 0; // Handle case where there are no query times
                                } else {
                                    const totalQueryTime = queryTimes.reduce((acc, time) => acc + time, 0);
                                    value = (totalQueryTime/1000) / queryTimes.length; // Calculate average
                                }
                                break;
                            case 'query_times':
                                const queryTimesArray = item.query_times.slice(1, -1).split(',').map(Number);
                                console.log('Query Times:', queryTimesArray);
                                console.log('Selected Query:', selectedQuery);
                                if (queryTimesArray.length === 0) {
                                    value = 0; // Handle case where there are no query times
                                } else {
                                    value = queryTimesArray[selectedQuery]/1000 || 0; // Use the selected query index
                                }
                                break;
                            default:
                                value = 0;
                        }

                        return {
                            target,
                            value
                        };
                    }).filter(item => item.value !== 0);

                const newAllTargets = data.map(item => item.target);
                if( allTargets.length !== newAllTargets.length ||
                    allTargets.every((target, index) => target === newAllTargets[index]) === false) {
                        setAllTargets(newAllTargets);
                        setSelectedTargets(newAllTargets);
                    }
                console.log("Targets:", allTargets);

                let filteredData = data.filter(item => selectedTargets.includes(item.target));

                if( selectedMetric === 'avg_ingest_mem' || selectedMetric === 'avg_query_mem' || selectedMetric === 'avg_query_time' || selectedMetric === 'query_times') {
                    const maxValue = Math.max(...filteredData.map(item => item.value));
                    const ratioData = filteredData.map(item => ({
                        target: item.target,
                        value: maxValue ? (maxValue / item.value) : 0, // Avoid division by zero
                    }));
                    filteredData = ratioData;
                }
                
                const sortedData = filteredData.sort((a, b) => b.value - a.value);
                setChartData(sortedData);
                setBarColors(sortedData.map(item => colorMapping[item.target as keyof typeof colorMapping] || '#000000')); // Set bar colors based on target
                console.log('Chart Data:', sortedData);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [type, metric, selectedMetric, selectedQuery, selectedTargets]);

    useEffect(() => {
        console.log('Updated Chart Data:', chartData);
    }, [chartData]);

    return (
        <Box
            display={'flex'}
            flexDirection={'column'}
            height={'100%'}
            width={'100%'}
            sx={{ marginLeft: 2 }}
        >
            <img src={logo} alt="CLPBench" style={{ width: '100px', height: 'auto', marginTop: '15px', marginBottom: '10px' }} />
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'background.paper',
                    color: 'text.secondary',
                    '& svg': {
                      m: 2,
                    },
                    [`& .${dividerClasses.root}`]: {
                      mx: 0.5,
                      borderWidth: '1px',
                    },
                }}
            >
                <Link href='https://github.com/y-scope/clp-bench/blob/main/docs/methodology.md'>Methodology</Link>
                <Divider orientation="vertical" flexItem />
                <Link href='https://docs.yscope.com/clp/main/user-guide/core-unstructured/clp.html'>CLP Documentation</Link>
            </Box>
            <Box
                role="group"
                aria-labelledby="fav-movie"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 2, marginTop: 2, }}
            >
                <span>Log Type: </span>
                <Chip
                    color={ 'unstructured' === type ? 'success' : 'neutral' }
                    onClick={() => setType('unstructured')}
                    variant="solid"
                >
                    Unstructured
                </Chip>
                <Chip
                    color={ 'semiStructured' === type ? 'success' : 'neutral' }
                    onClick={() => setType('semiStructured')}
                    variant="solid"
                >
                    Semi-Structured
                </Chip>
            </Box>
            <Box
                role="group"
                aria-labelledby="target-selection"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 2 }}
            >
                <span>Select Targets: </span>
                {allTargets.map(target => (
                    <Chip
                        key={target}
                        color={selectedTargets.includes(target) ? 'success' : 'neutral'}
                        onClick={() => {
                            setSelectedTargets(prev => 
                                prev.includes(target) 
                                ? prev.filter(t => t !== target) 
                                : [...prev, target]
                            );
                        }}
                        variant="solid"
                    >
                        {target}
                    </Chip>
                ))}
            </Box>
            <Box
                role="group"
                aria-labelledby="metric-selection"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 2 }}
            >
                <span>Select Metric: </span>
                <Chip
                    color={selectedMetric === 'compressionRatio' ? 'success' : 'neutral'}
                    onClick={() => setSelectedMetric('compressionRatio')}
                    variant="solid"
                >
                    Compression Ratio
                </Chip>
                <Chip
                    color={selectedMetric === 'ingestion_speed' ? 'success' : 'neutral'}
                    onClick={() => setSelectedMetric('ingestion_speed')}
                    variant="solid"
                >
                    Ingestion Speed
                </Chip>
                <Chip
                    color={selectedMetric === 'avg_ingest_mem' ? 'success' : 'neutral'}
                    onClick={() => setSelectedMetric('avg_ingest_mem')}
                    variant="solid"
                >
                    Ingestion Memory Efficiency
                </Chip>
                <Chip
                    color={selectedMetric === 'avg_query_mem' ? 'success' : 'neutral'}
                    onClick={() => setSelectedMetric('avg_query_mem')}
                    variant="solid"
                >
                    Search Memory Efficiency
                </Chip>
                <Chip
                    color={selectedMetric === 'avg_query_time' ? 'success' : 'neutral'}
                    onClick={() => setSelectedMetric('avg_query_time')}
                    variant="solid"
                >
                    Average Query Efficiency
                </Chip>
                <Chip
                    color={selectedMetric === 'query_times' ? 'success' : 'neutral'}
                    onClick={() => {
                        setSelectedMetric('query_times');
                    }}
                    variant="solid"
                >
                    Individual Query Efficiency
                </Chip>
            </Box>
            {(selectedMetric === 'query_times' || selectedMetric === 'avg_query_time' || selectedMetric === 'avg_query_mem') && (
            <Box
                role="group"
                aria-labelledby="fav-movie"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 2, }}
            >
                <span>Run Type: </span>
                <Chip
                    color={ 'hotRun' === metric ? 'success' : 'neutral' }
                    onClick={() => setMetric('hotRun')}
                    variant="solid"
                >
                    Hot Run
                </Chip>
                <Chip
                    color={ 'coldRun' === metric ? 'success' : 'neutral' }
                    onClick={() => setMetric('coldRun')}
                    variant="solid"
                >
                    Cold Run
                </Chip>
            </Box>
            )}
            {selectedMetric === 'query_times' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, marginBottom: 2 }}>
                <span>Query Number: </span>
                {Array.from({ length: 13 }, (_, index) => {
                    const label = `Q${index + 1}`;
                    return (
                    <Chip 
                        color={selectedQuery === index ? 'success' : 'neutral'}
                        key={index} 
                        variant="solid"
                        onClick={() => {
                            setSelectedQuery(index);
                        }}
                    >
                        {label}
                    </Chip>
                    );
                })}
            </Box>
            )}
            <span>The used benchmark workload: {benchmarkWorkload}</span>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    mb: 2, // margin bottom for spacing
                }}
                >
                <Typography component="h2">
                    {getSeriesLabel(selectedMetric)}
                </Typography>
            </Box>
            {loading ? (
                <div>Loading data...</div> // Show loading message or spinner
            ) : chartData.length > 0 ? (
                <BarChart
                    dataset={chartData}
                    xAxis={[{ 
                        dataKey: 'target', 
                        scaleType: 'band',
                        colorMap: {
                            type: "ordinal",
                            values: chartData.map(item => item.target),
                            colors: barColors,
                          },
                    }]}
                    series={[
                        { 
                            dataKey: 'value', 
                        },
                    ]}
                    barLabel={
                        (data) => getBarLabel(selectedMetric, data.value ?? 0)
                    }
                />
            ) : (
                <div>No data available for the selected type and metric.</div>
            )}
            </Box>
        );
    }
    
    export default BarCharts;