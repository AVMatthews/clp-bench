import './App.css';
import logo from './assets/clp-logo.png';
import { useEffect, useState } from 'react';
import { Box, Chip, Link, Tooltip as JoyTooltip, Typography } from '@mui/joy';
import Divider, { dividerClasses } from '@mui/material/Divider';
import InfoIcon from '@mui/icons-material/Info';
import IconButton from '@mui/material/IconButton';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
  Label,
} from 'recharts';

const TYPE = ['', 'unstructured', 'json'];
const METRIC = ['', 'hotRun', 'coldRun'];

type BenchmarkingResultBasic<T> = {
  [type: string]: { [metric: string]: T };
};

function BenchmarkingResultBasicInitializer<T>(cb: (t: string, m: string) => T) {
  return TYPE.reduce((acc, type) => {
    if (!type) return acc;
    acc[type] = METRIC.reduce((mAcc, m) => {
      if (!m) return mAcc;
      mAcc[m] = cb(type, m);
      return mAcc;
    }, {} as Record<string, T>);
    return acc;
  }, {} as BenchmarkingResultBasic<T>);
}

const BENCHMARK_WORKLOAD = BenchmarkingResultBasicInitializer<{
  name: string;
  size: number;
}>((type) => {
  if (type === 'unstructured')
    return { name: 'Hadoop (258 GB)', size: 276224164352 };
  if (type === 'json')
    return { name: 'MongoDB (64 GB)', size: 69582861765 };
  return { name: 'ERROR', size: 0 };
});

const getSeriesLabel = (metric: string) => {
  const map: Record<string, string> = {
    compressionRatio:
      'Compression Ratio',
    ingestionSpeed: 'Ingestion Speed',
    avg_ingest_mem: 'Ingestion Memory Usage',
    avg_query_mem: 'Search Memory Usage',
    query_times: 'Query Latency',
  };
  return map[metric] || metric;
};

const getBarLabel = (metric: string, dataType: string, value: number) => {
  let suffix = '';
  if (metric === 'ingestionSpeed'){
    suffix = ' MB/s';
  } else if ((metric === 'avg_ingest_mem' || metric === 'avg_query_mem') && dataType === 'raw') {
    suffix = ' GB';
  } else if (metric === 'query_times' && dataType === 'raw') {
    suffix = 's';
  }else if (metric === 'compressionRatio') {
    suffix = ' : 1';
  }else{
    suffix = 'x';
  }

  if ( value < 1){
    return value.toFixed(2) + suffix;
  }else {
    console.log(value);
    if  ((value % 1) < 0.05 || (value % 1) > 0.95) {
        return value.toFixed(0) + suffix;
    }
    return value.toFixed(1) + suffix;
  }
};

const colorMapping: Record<string, string> = {
  CLP: '#00C7BD',
  'CLP-S': '#00C7BD',
  Splunk: '#E20082',
  Elasticsearch: '#008EC2',
  Loki: '#A4A4A4',
  grep: '#2DE109',
  ClickHouse: '#F0B400',
  'ClickHouse (JSON)': '#FFDD1A',
  MongoDB: '#008535',
  OpenObserve: '#8A14FF',
  'OpenObserve (w/ LIMIT)': '#BD7AFF',
};

const TARGET_ORDER = [
    'CLP',
    'CLP-S',
    'Elasticsearch',
    'Splunk',
    'ClickHouse',
    'ClickHouse (JSON)',
    'OpenObserve',
    'OpenObserve (w/ LIMIT)',
    'MongoDB',
    'Loki',
    'grep',
  ];

const metricOptions = [
    'compressionRatio',
    'query_times',
    'avg_query_mem',
    'avg_ingest_mem',
    'ingestionSpeed',
];

function ReCharts() {
  const [type, setType] = useState(TYPE[2]);
  const [metric, setMetric] = useState(METRIC[1]);
  const [selectedMetric, setSelectedMetric] = useState('compressionRatio');
  const [selectedQuery, setSelectedQuery] = useState(0);
  const [allTargets, setAllTargets] = useState<string[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [benchmarkWorkload, setBenchmarkWorkload] = useState('');
  const [loading, setLoading] = useState(true);
  //default, raw, comparison
  const [dataType, setDataType] = useState('raw');
  const [queryLength , setQueryLength] = useState(6);

  useEffect(() => {
    if (type === 'unstructured') {
        setQueryLength(13);
    }else {
        setQueryLength(6);
    }

    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`api/get`);
        const result = (await res.json()) as {
          payload: any[];
        };

        const sizeMB =
          BENCHMARK_WORKLOAD[type][metric].size / 1024 / 1024;
        setBenchmarkWorkload(
          BENCHMARK_WORKLOAD[type][metric].name
        );

        let data = result.payload
          .filter(
            (i) =>
              i.type === TYPE.indexOf(type) &&
              i.metric === METRIC.indexOf(metric) &&
              i.is_enable
          )
          .map((item) => {
            let value = 0;
            const Q = (qs: string) =>
              qs
                .slice(1, -1)
                .split(',')
                .map(Number);
            switch (selectedMetric) {
              case 'compressionRatio':
                if (item.compressed_size && sizeMB)
                  value =
                    sizeMB /
                    (item.compressed_size / 1024 / 1024);
                break;
              case 'ingestionSpeed':
                if (item.ingest_time && sizeMB)
                  value = sizeMB / (item.ingest_time / 1000);
                break;
              case 'avg_ingest_mem':
                value = item.avg_ingest_mem / 1024 / 1024 / 1024;
                break;
              case 'avg_query_mem':
                value = item.avg_query_mem / 1024 / 1024 / 1024;
                break;
              case 'query_times': {
                if(selectedQuery === -1) {
                    const arr = Q(item.query_times);
                    value =
                      arr.length
                        ? (arr.reduce((a, b) => a + b, 0) / 1000 / arr.length)
                        : 0;
                    break; 
                }
                const arr = Q(item.query_times);
                value = arr[selectedQuery] / 1000 || 0;
                break;
              }
            }
            return {
              target: item.target_displayed_name,
              value,
            };
          })
          .filter((d) => d.value > 0);

        const targets = data.map((d) => d.target);
        if (
          targets.length !== allTargets.length ||
          !targets.every((t, i) => allTargets[i] === t)
        ) {
          setAllTargets(targets);
          setSelectedTargets(targets);
        }

        let filtered = data.filter((d) =>
          selectedTargets.includes(d.target)
        );

        console.log(dataType);

        if (
          ['avg_ingest_mem', 'avg_query_mem', 'query_times'].includes(
            selectedMetric
          ) &&
          dataType === 'comparison'
        ) {
          const mx = Math.max(...filtered.map((d) => d.value));
          filtered = filtered.map((d) => ({
            target: d.target,
            value: mx / (d.value || 1),
          }));
        }

        if( selectedMetric === 'compressionRatio' || selectedMetric === 'ingestionSpeed') {
            filtered.sort((a, b) => b.value - a.value);
        }else if(dataType === 'comparison') {
            filtered.sort((a, b) => b.value - a.value);
        }else{
            filtered.sort((a, b) => a.value - b.value);
        }
        setChartData(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [
    type,
    metric,
    selectedMetric,
    selectedQuery,
    selectedTargets.join(','),
    dataType
  ]);

  return (
    <Box className="flex-container"> {/* Use the flex container class */}
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <img
                src={logo}
                alt="CLPBench"
                style={{ width: 100, margin: '15px 0' }}
            />
        </Box>
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: 'background.paper',
                color: 'text.secondary',
                [`& .${dividerClasses.root}`]: {
                    mx: 0.5,
                    borderWidth: '1px',
                },
            }}
        >
            <Link href="https://github.com/y-scope/clp-bench/blob/main/docs/methodology.md">
            Methodology
            </Link>
            <Divider orientation="vertical" flexItem />
            <Link href="https://docs.yscope.com/clp/main/user-guide/core-unstructured/clp.html">
            CLP Documentation
            </Link>
        </Box>

        {/* Type selector */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                Log Format
                <JoyTooltip title="Information about Log Type" arrow>
                <IconButton
                    aria-label="info"
                    sx={{
                        color: '#5bc0de', 
                        width: '30px', 
                        height: '20px', 
                        fontSize: '20px', 
                    }}
                    onClick={(e) => {
                        // You can also toggle the tooltip on click if needed
                        // For example, using a state to control visibility
                    }}
                >
                    <InfoIcon sx={{ fontSize: '20px' }}/>
                </IconButton>
                </JoyTooltip>
                :
            </Typography>
            {['json', 'unstructured'].map((t) => (
            <Chip
                key={t}
                color={type === t ? 'success' : 'neutral'}
                onClick={() => setType(t)}
                variant="solid"
                style={{ fontFamily: 'Roboto,sans-serif'}}
            >
                {t === 'json'
                ? 'JSON'
                : 'Unstructured'}
            </Chip>
            ))}
        </Box>

        {/* Tools */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
        <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                Tools
            <IconButton
                aria-label="info"
                sx={{
                    color: '#5bc0de', 
                    width: '30px', 
                    height: '20px', 
                    fontSize: '20px', 
                }}
                onClick={(e) => {
                    // You can also toggle the tooltip on click if needed
                    // For example, using a state to control visibility
                }}
            >
                <InfoIcon sx={{ fontSize: '20px' }}/>
            </IconButton>:
            </Typography>
            {[...allTargets]
                .sort((a, b) => TARGET_ORDER.indexOf(a) - TARGET_ORDER.indexOf(b))
                .map(target => (
            <Chip
                key={target}
                color={selectedTargets.includes(target) ? 'success' : 'neutral'}
                onClick={() =>
                setSelectedTargets((prev) =>
                    prev.includes(target)
                    ? prev.filter((x) => x !== target)
                    : [...prev, target]
                )
                }
                variant="solid"
                style={{ fontFamily: 'Roboto,sans-serif'}}
            >
                {target}
            </Chip>
            ))}
        </Box>

        {/* Metric selector */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
        <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                Metric
            <IconButton
                aria-label="info"
                sx={{
                    color: '#5bc0de', 
                    width: '30px', 
                    height: '20px', 
                    fontSize: '20px', 
                }}
                onClick={(e) => {
                    // You can also toggle the tooltip on click if needed
                    // For example, using a state to control visibility
                }}
            >
                <InfoIcon sx={{ fontSize: '20px' }}/>
            </IconButton>:
            </Typography>
            {metricOptions.map((m) => (
            <Chip
                key={m}
                color={selectedMetric === m ? 'success' : 'neutral'}
                onClick={() => {
                setSelectedMetric(m);
                setSelectedQuery(-1);
                }}
                variant="solid"
                style={{ fontFamily: 'Roboto,sans-serif'}}
            >
                {getSeriesLabel(m)}
            </Chip>
            ))}
        </Box>

        {/* Hot/cold runs */}
        {['avg_query_time', 'avg_query_mem', 'query_times'].includes(
            selectedMetric
        ) && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                    Run Type
                <IconButton
                    aria-label="info"
                    sx={{
                        color: '#5bc0de', 
                        width: '30px', 
                        height: '20px', 
                        fontSize: '20px', 
                    }}
                    onClick={(e) => {
                        // You can also toggle the tooltip on click if needed
                        // For example, using a state to control visibility
                    }}
                >
                    <InfoIcon sx={{ fontSize: '20px' }}/>
                </IconButton>:
                </Typography>
                {['hotRun', 'coldRun'].map((m) => (
                    <Chip
                    key={m}
                    color={metric === m ? 'success' : 'neutral'}
                    onClick={() => setMetric(m)}
                    variant="solid"
                    style={{ fontFamily: 'Roboto,sans-serif'}}
                    >
                    {m === 'hotRun' ? 'Hot Run' : 'Cold Run'}
                    </Chip>
                ))}
            </Box>
        )}

        {['avg_query_mem', 'avg_ingest_mem', 'query_times'].includes(
            selectedMetric
        ) && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                    Data Format
                <IconButton
                    aria-label="info"
                    sx={{
                        color: '#5bc0de', 
                        width: '30px', 
                        height: '20px', 
                        fontSize: '20px', 
                    }}
                    onClick={(e) => {
                        // You can also toggle the tooltip on click if needed
                        // For example, using a state to control visibility
                    }}
                >
                    <InfoIcon sx={{ fontSize: '20px' }}/>
                </IconButton>:
                </Typography>
                {['raw', 'comparison'].map((d) => (
                    <Chip
                    key={d}
                    color={dataType === d ? 'success' : 'neutral'}
                    onClick={() => setDataType(d)}
                    variant="solid"
                    style={{ fontFamily: 'Roboto,sans-serif'}}
                    >
                    {d === 'raw' ? 'Raw' : 'Comparison'}
                    </Chip>
                ))}
            </Box>
        )}

        {/* Query selector */}
        {selectedMetric === 'query_times' && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                    Query #
                <IconButton
                    aria-label="info"
                    sx={{
                        color: '#5bc0de', 
                        width: '30px', 
                        height: '20px', 
                        fontSize: '20px', 
                    }}
                    onClick={(e) => {
                        // You can also toggle the tooltip on click if needed
                        // For example, using a state to control visibility
                    }}
                >
                    <InfoIcon sx={{ fontSize: '20px' }}/>
                </IconButton>:
                </Typography>
                <Chip
                color={selectedQuery === -1 ? 'success' : 'neutral'}
                onClick={() => setSelectedQuery(-1)} // -1 for average
                variant="solid"
                style={{ fontFamily: 'Roboto,sans-serif'}}
                >
                Average
                </Chip>
                {Array.from({ length: queryLength }).map((_, i) => (
                <Chip
                    key={i}
                    color={selectedQuery === i ? 'success' : 'neutral'}
                    onClick={() => setSelectedQuery(i)}
                    variant="solid"
                    style={{ fontFamily: 'Roboto,sans-serif'}}
                >
                    Q{i + 1}
                </Chip>
                ))}
            </Box>
        )}


      <Box mt={2}>
      <Typography variant="body1" sx={{color: 'text.primary', marginRight: 1 }}>
                Workload Used
        <IconButton
            aria-label="info"
            sx={{
                color: '#5bc0de',
                width: '30px', 
                height: '20px', 
                fontSize: '20px', 
            }}
            onClick={(e) => {
                // You can also toggle the tooltip on click if needed
                // For example, using a state to control visibility
            }}
        >
            <InfoIcon sx={{ fontSize: '20px' }}/>
        </IconButton>: <b>{benchmarkWorkload}</b>
        </Typography>
      </Box>

        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <Typography level="h3" sx={{color: 'text.primary', marginRight: 1 }}>
                {getSeriesLabel(selectedMetric)}
            <IconButton
                aria-label="info"
                sx={{
                    color: '#5bc0de',
                    width: '30px',
                    height: '20px',
                    fontSize: '20px',
                }}
                onClick={(e) => {
                    // You can also toggle the tooltip on click if needed
                    // For example, using a state to control visibility
                }}
            >
                <InfoIcon sx={{ fontSize: '20px' }}/>
            </IconButton>
            </Typography>
        </Box>
      {loading ? (
        <Box textAlign="center" mt={4}>Loading data…</Box>
      ) : chartData.length ? (
        <Box display="flex" alignItems="center">
            {(selectedMetric === 'compressionRatio' || selectedMetric === 'ingestionSpeed' || dataType === 'comparison') ? (<Box 
                style={{ 
                    writingMode: 'vertical-rl', 
                    transform: 'rotate(180deg)', 
                    marginRight: '2px', 
                    fontFamily: 'Roboto', 
                    fontSize: '20px', 
                    textAlign: 'left', 
                }}
            >
                <text>
                    <b>Worse&emsp;&lArr;</b>
                    &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
                    <b>&rArr;&emsp; Better</b>     
                </text>
            </Box>): (<Box 
                style={{ 
                    writingMode: 'vertical-rl', 
                    transform: 'rotate(180deg)', 
                    marginRight: '2px', 
                    fontFamily: 'Roboto', 
                    fontSize: '20px', 
                    textAlign: 'left', 
                }}
            >
                <text>
                    <b>Better&emsp;&lArr;</b>
                    &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
                    <b>&rArr;&emsp;Worse</b>     
                </text>
            </Box>)}
            <Box className="chart-container"> {/* Chart container */}
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 40, bottom: 40, left:-20, }}>
                        <XAxis style={{ fontFamily: 'Roboto' }} dataKey="target" />
                        <YAxis 
                            style={{ fontFamily: 'Roboto'}}>
                        </YAxis>
                        <Tooltip formatter={(v: number) => v.toFixed(2)} />
                        <Bar dataKey="value" isAnimationActive={false}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colorMapping[entry.target] || '#8884d8'} />
                            ))}
                            <LabelList
                                dataKey="value"
                                position="top"
                                style={{ fontSize: 32, fontWeight: 'bold', fill: '#4a4a4a' , fontFamily: 'Roboto' }}
                                formatter={(v: number) => getBarLabel(selectedMetric, dataType, v)}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Box>
            </Box>
      ) : (
        <Box textAlign="center" mt={4}>
          No data available for the selected type and metric.
        </Box>
      )}
    </Box>
  );
}

export default ReCharts;