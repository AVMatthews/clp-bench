import './App.css';
import logo from './assets/clp-logo.png';
import { useEffect, useState } from 'react';
import { Box, Chip, Link, Stack, Table, Tooltip as JoyTooltip, Typography } from '@mui/joy';
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
  Text,
  LabelList,
} from 'recharts';

const TYPE = ['', 'unstructured', 'json'];
const METRIC = ['', 'hotRun', 'coldRun'];
const JSONDATASETS = ['Average', 'MongoDB', 'Elasticsearch', 'CockroachDB', 'PostgreSQL', 'spark-event-logs'];

const iconButtonStyle= {
    color: '#5bc0de', 
    width: '30px', 
    height: '20px', 
    fontSize: '20px', 
}
const infoIconStyle = {
    fontSize: '20px',
}

const selectorStyle = {
    fontFamily: 'Roboto,sans-serif',
    fontSize: '16px',
    color: 'text.primary', 
    marginRight: 1,
}

const yaxisLabelStyle = {
    writingMode: 'vertical-rl', 
    transform: 'rotate(180deg)', 
    marginRight: '2px', 
    fontFamily: 'Roboto', 
    fontSize: '17px', 
    textAlign: 'left', 
}

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
        return value.toFixed(0) + suffix;
    } else if ((metric === 'avg_ingest_mem' || metric === 'avg_query_mem') && dataType === 'raw') {
        suffix = ' GB';
    } else if (metric === 'query_times' && dataType === 'raw') {
        suffix = 's';
    }else if (metric === 'compressionRatio') {
        suffix = ' : 1';
        return value.toFixed(0) + suffix;
    }else{
        suffix = 'x';
    }

    if ( value < 1){
        return value.toFixed(2) + suffix;
    }else {
        if  ((value % 1) < 0.05 || (value % 1) > 0.95) {
            return value.toFixed(0) + suffix;
        }
        return value.toFixed(1) + suffix;
    }
};

const metricOptions = [
    'compressionRatio',
    'query_times',
    'avg_query_mem',
    'avg_ingest_mem',
    'ingestionSpeed',
];

const CustomXAxisTick = ({ x, y, payload }: any) => {
    if (payload && payload.value) {
      return (
        <Text
            className='xaxis-label'
            width={200} // Adjust width as needed
            x={x} 
            y={y} 
            textAnchor="middle"
            style={{ fontFamily: 'Roboto,sans-serif', fill: '#4a4a4a'}}
            verticalAnchor="start"
            angle={0}
        >{payload.value}</Text>
      );
    }
    return null;
};

function ReCharts() {
  const [type, setType] = useState(TYPE[2]);
  const [metric, setMetric] = useState(METRIC[1]);
  const [dataset, setDataset] = useState('Average');
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

        setBenchmarkWorkload(
          BENCHMARK_WORKLOAD[type][metric].name
        );

        const data = result.payload
          .filter(
            (i) =>
              i.type === TYPE.indexOf(type) &&
              i.metric === METRIC.indexOf(metric) &&
              i.dataset === dataset
          )
          .map((item) => {
            let value = 0;
            const sizeMB = item.size / 1024 / 1024;

            const Q = (qs: string) =>
              qs
                .slice(1, -1)
                .split(',')
                .map(Number);
            switch (selectedMetric) {
              case 'compressionRatio':
                /* if (item.compressed_size && sizeMB)
                  value =
                    sizeMB /
                    (item.compressed_size / 1024 / 1024); */
                if (item.compression_ratio)
                    value = item.compression_ratio
                break;
              case 'ingestionSpeed':
                /* if (item.ingest_time && sizeMB)
                  value = sizeMB / (item.ingest_time / 1000); */
                if (item.ingestion_speed)
                    value = item.ingestion_speed
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
              color: item.color,
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

        if (
          ['avg_ingest_mem', 'avg_query_mem', 'query_times'].includes(
            selectedMetric
          ) &&
          dataType === 'comparison'
        ) {
          const mx = Math.max(...filtered.map((d) => d.value));
          filtered = filtered.map((d) => ({
            target: d.target,
            color: d.color,
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
    dataType,
    dataset
  ]);

  return (
    <Box className="flex-container">
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
        
        <Box sx={{display: 'flex', height: 40}}>
        {((type === 'json' && (selectedMetric === 'query_times' || selectedMetric === 'avg_query_mem'))|| type === 'unstructured') && (
        <Box>
            <Typography sx={selectorStyle}>
                    Dataset
            <IconButton
                sx={iconButtonStyle}
                onClick={(e) => {
                }}
            >
                <InfoIcon sx={infoIconStyle}/>
            </IconButton>: <b>{benchmarkWorkload}</b>
            </Typography>
        </Box>
        )}
        </Box>

        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: 30}}>
            <Typography level="h4" sx={{color: 'text.primary', marginRight: 1 }}>
                {getSeriesLabel(selectedMetric)}
            <IconButton
                sx={iconButtonStyle}
                onClick={(e) => {
                    // You can also toggle the tooltip on click if needed
                    // For example, using a state to control visibility
                }}
            >
                <InfoIcon sx={infoIconStyle}/>
            </IconButton>
            </Typography>
        </Box>

        <Box sx={{ width: '100%', height: '500px', position: 'relative' }}>
        {loading ? (
            <Box textAlign="center" mt={4}>Loading data…</Box>
        ) : chartData.length ? (
            <Box display="flex" alignItems="center">
                {(selectedMetric === 'compressionRatio' || selectedMetric === 'ingestionSpeed' || dataType === 'comparison') ? (<Box 
                    style={yaxisLabelStyle}
                >
                    <text>
                        &emsp;&emsp;&emsp;<b>Worse&emsp;&lArr;</b>
                        &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
                        <b>&rArr;&emsp; Better</b>     
                    </text>
                </Box>): (<Box 
                    style={yaxisLabelStyle}
                >
                    <text>
                        &emsp;&emsp;&emsp;<b>Better&emsp;&lArr;</b>
                        &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
                        <b>&rArr;&emsp;Worse</b>     
                    </text>
                </Box>)}
                <Box className="chart-container"> {/* Chart container */}
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 50, bottom: 70, left:-20, right:60}}>
                            <XAxis interval={0} style={{ fontFamily: 'Roboto' }} tick={<CustomXAxisTick/>} dataKey="target"/>
                            <YAxis 
                                style={{ fontFamily: 'Roboto', fontSize: "18px"}}>
                            </YAxis>
                            <Tooltip formatter={(v: number) => v.toFixed(2)} />
                            <Bar dataKey="value" isAnimationActive={false}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
                                ))}
                                <LabelList
                                    dataKey="value"
                                    position="top"
                                    width= {150}
                                    style={{ fontSize: '1.3vw', fontWeight: 'bold', fill: '#4a4a4a' , fontFamily: 'Roboto' }}
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

        <Box sx={{ width: '100%', height: '450px', position: 'relative' }}>
        <Table>
        <tbody>
            {/* Type selector */}
            {/* 
            <tr>
                <td style={{ width: '10%' }}>
                <Typography sx={selectorStyle}>
                    Log Type
                    <JoyTooltip title="Log Type" arrow>
                    <IconButton sx={iconButtonStyle}>
                        <InfoIcon sx={infoIconStyle}/>
                    </IconButton>
                    </JoyTooltip>
                    :
                </Typography>
                </td>
                <td>
                <Stack direction="row" spacing={1}>
                {['json', 'unstructured'].map((t) => (
                <Chip
                    key={t}
                    color={type === t ? 'success' : 'neutral'}
                    onClick={() => {
                        setType(t)
                        if(t === "json" && (
                            selectedMetric === 'compressionRatio' || 
                            selectedMetric === 'avg_ingest_mem' || 
                            selectedMetric === 'ingestionSpeed'
                        )){
                            setDataset('Average')
                        }else if (t === "json"){
                            setDataset('MongoDB')
                        }else{
                            setDataset('Hadoop')
                        }
                    
                    }}
                    variant="solid"
                    style={{ fontFamily: 'Roboto,sans-serif'}}
                >
                    {t === 'json'
                    ? 'JSON'
                    : 'Unstructured'}
                </Chip>
                ))}
                </Stack>
                </td>
            </tr> 
            */}

            
            {/* Tools */}
            <tr>
                <td style={{ width: '10%' }}>
                <Typography sx={selectorStyle}>
                        Tools
                    <IconButton sx={iconButtonStyle}>
                        <InfoIcon sx={infoIconStyle}/>
                    </IconButton>:
                </Typography>
                </td>
                <td>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap'}}>
                <Chip
                    key="select-all"
                    color={selectedTargets.length === allTargets.length ? 'neutral' : 'success'}
                    onClick={() => {
                        if (selectedTargets.length < allTargets.length) {
                            setSelectedTargets([...allTargets]);
                        }
                    }}
                    variant="solid"
                    sx={{ 
                        fontFamily: 'Roboto,sans-serif', 
                        borderRadius: '8px' // Change this value for more or less rounding
                    }}
                >
                    Select All
                </Chip>
                <Chip
                    key="select-none"
                    color={selectedTargets.length === 0 ? 'neutral' : 'success'}
                    onClick={() => {
                        if (selectedTargets.length > 0) {
                            setSelectedTargets([]);
                        }
                    }}
                    variant="solid"
                    sx={{ 
                        fontFamily: 'Roboto,sans-serif', 
                        borderRadius: '8px' // Change this value for more or less rounding
                    }}
                >
                    Clear
                </Chip>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', marginTop: 2}}>
                {[...allTargets]
                    .sort()
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
                </Stack>
                </td>
            </tr>

            {/* Metric selector */}
            <tr>
                <td>
                <Typography sx={selectorStyle}>
                    Metric
                <IconButton sx={iconButtonStyle}>
                    <InfoIcon sx={infoIconStyle}/>
                </IconButton>:
                </Typography>
                </td>
                <td>
                <Stack direction="row" spacing={1}>
                {metricOptions.map((m) => (
                <Chip
                    key={m}
                    color={selectedMetric === m ? 'success' : 'neutral'}
                    onClick={() => {
                        setSelectedMetric(m);
                        setSelectedQuery(-1);
                        if(type === "json" && (m === 'query_times' || m ==='avg_query_mem')){
                            setDataset("MongoDB")
                        }

                    }}
                    variant="solid"
                    style={{ fontFamily: 'Roboto,sans-serif'}}
                >
                    {getSeriesLabel(m)}
                </Chip>
                ))}
                </Stack>
                </td>
            </tr>

            {((
                selectedMetric === 'compressionRatio' || 
                selectedMetric === 'avg_ingest_mem' || 
                selectedMetric === 'ingestionSpeed'
            ) && type === 'json' ) && (
                <tr>
                    <td>
                    <Typography sx={selectorStyle}>
                        Dataset
                    <IconButton sx={iconButtonStyle}>
                        <InfoIcon sx={infoIconStyle}/>
                    </IconButton>:
                    </Typography>
                    </td>
                    <td>
                    <Stack direction="row" spacing={1}>
                    {JSONDATASETS.map((d) => (
                        <Chip
                        key={d}
                        color={dataset === d ? 'success' : 'neutral'}
                        onClick={() => setDataset(d)}
                        variant="solid"
                        style={{ fontFamily: 'Roboto,sans-serif'}}
                        >
                        {d}
                        </Chip>
                    ))}
                    </Stack>
                    </td>
                </tr>
            )}

            {/* Hot/cold runs */}
            {['avg_query_time', 'avg_query_mem', 'query_times'].includes(
                selectedMetric
            ) && (
                <tr>
                    <td>
                    <Typography sx={selectorStyle}>
                        Run Type
                    <IconButton sx={iconButtonStyle}>
                        <InfoIcon sx={infoIconStyle}/>
                    </IconButton>:
                    </Typography>
                    </td>
                    <td>
                    <Stack direction="row" spacing={1}>
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
                    </Stack>
                    </td>
                </tr>
            )}

            {/*Dataset Selector*/}
            {['avg_query_mem', 'avg_ingest_mem', 'query_times'].includes(
                selectedMetric
            ) && (
                <tr>
                    <td>
                    <Typography sx={selectorStyle}>
                        Data Format
                    <IconButton sx={iconButtonStyle}>
                        <InfoIcon sx={infoIconStyle}/>
                    </IconButton>:
                    </Typography>
                    </td>
                    <td>
                    <Stack direction="row" spacing={1}>
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
                    </Stack>
                    </td>
                </tr>
            )}

            {/* Query selector */}
            {selectedMetric === 'query_times' && (
                <tr>
                    <td>
                    <Typography sx={selectorStyle}>
                        Query #
                    <IconButton sx={iconButtonStyle}>
                        <InfoIcon sx={infoIconStyle}/>
                    </IconButton>:
                    </Typography>
                    </td>
                    <td>
                    <Stack direction="row" spacing={1}>
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
                    </Stack>
                    </td>
                </tr>
            )}
        </tbody>
        </Table>
        </Box>
    </Box>
  );
}

export default ReCharts;