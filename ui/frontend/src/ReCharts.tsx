import './App.css';
import logo from './assets/clp-logo.png';
import { useEffect, useState } from 'react';
import { Box, Chip, Link, Typography } from '@mui/joy';
import Divider, { dividerClasses } from '@mui/material/Divider';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LabelList,
} from 'recharts';

const TYPE = ['', 'unstructured', 'semiStructured'];
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
  if (type === 'semiStructured')
    return { name: 'MongoDB (64 GB)', size: 69582861765 };
  return { name: 'ERROR', size: 0 };
});

const getSeriesLabel = (metric: string) => {
  const map: Record<string, string> = {
    compressionRatio:
      'Compression Ratio (Original Size / Compressed Size)',
    ingestion_speed: 'Ingestion Speed (MB/s)',
    avg_ingest_mem: 'Ingestion Memory Efficiency',
    avg_query_mem: 'Search Memory Efficiency',
    query_times: 'Query Efficiency',
  };
  return map[metric] || metric;
};

const getBarLabel = (metric: string, dataType: string, value: number) => {
  let suffix = '';
  if (metric === 'ingestion_speed'){
    suffix = 'MB/s';
  } else if ((metric === 'avg_ingest_mem' || metric === 'avg_query_mem') && dataType === 'raw') {
    suffix = 'GB';
  } else if (metric === 'query_times' && dataType === 'raw') {
    suffix = 's';
  }else{
    suffix = 'x';
  }

  if ( value < 1){
    return value.toFixed(2) + suffix;
  }else {
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

function ReCharts() {
  const [type, setType] = useState(TYPE[1]);
  const [metric, setMetric] = useState(METRIC[1]);
  const [selectedMetric, setSelectedMetric] = useState('compressionRatio');
  const [selectedQuery, setSelectedQuery] = useState(0);
  const [allTargets, setAllTargets] = useState<string[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [benchmarkWorkload, setBenchmarkWorkload] = useState('');
  const [loading, setLoading] = useState(true);
  //default, comparison, raw
  const [dataType, setDataType] = useState('default');

  useEffect(() => {
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
              case 'ingestion_speed':
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
          dataType !== 'raw'
        ) {
          const mx = Math.max(...filtered.map((d) => d.value));
          filtered = filtered.map((d) => ({
            target: d.target,
            value: mx / (d.value || 1),
          }));
        }

        if( selectedMetric === 'compressionRatio' || selectedMetric === 'ingestion_speed') {
            filtered.sort((a, b) => b.value - a.value);
        }else if(dataType === 'raw') {
            filtered.sort((a, b) => a.value - b.value);
        }else{
            filtered.sort((a, b) => b.value - a.value);
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

  const metricOptions = [
    'compressionRatio',
    'query_times',
    'avg_query_mem',
    'avg_ingest_mem',
    'ingestion_speed',
  ];

  return (
    <Box sx={{ margin: 2 }}>
        <img
            src={logo}
            alt="CLPBench"
            style={{ width: 100, margin: '15px 0' }}
        />
        <Box
            sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'background.paper',
            color: 'text.secondary',
            '& svg': { m: 2 },
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
            <span>Log Type:</span>
            {['unstructured', 'semiStructured'].map((t) => (
            <Chip
                key={t}
                color={type === t ? 'success' : 'neutral'}
                onClick={() => setType(t)}
                variant="solid"
            >
                {t === 'unstructured'
                ? 'Unstructured'
                : 'Semi‑Structured'}
            </Chip>
            ))}
        </Box>

        {/* Targets */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <span>Select Targets:</span>
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
            >
                {target}
            </Chip>
            ))}
        </Box>

        {/* Metric selector */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <span>Select Metric:</span>
            {metricOptions.map((m) => (
            <Chip
                key={m}
                color={selectedMetric === m ? 'success' : 'neutral'}
                onClick={() => {
                setSelectedMetric(m);
                setSelectedQuery(-1);
                }}
                variant="solid"
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
            <span>Run Type:</span>
            {['hotRun', 'coldRun'].map((m) => (
                <Chip
                key={m}
                color={metric === m ? 'success' : 'neutral'}
                onClick={() => setMetric(m)}
                variant="solid"
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
            <span>Data Format:</span>
            {['comparison', 'raw'].map((d) => (
                <Chip
                key={d}
                color={dataType === d ? 'success' : 'neutral'}
                onClick={() => setDataType(d)}
                variant="solid"
                >
                {d === 'comparison' ? 'Comparison' : 'Raw'}
                </Chip>
            ))}
            </Box>
        )}

        {/* Query selector */}
        {selectedMetric === 'query_times' && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <span>Query Number:</span>
                <Chip
                color={selectedQuery === -1 ? 'success' : 'neutral'}
                onClick={() => setSelectedQuery(-1)} // -1 for average
                variant="solid"
                >
                Average
                </Chip>
                {Array.from({ length: 13 }).map((_, i) => (
                <Chip
                    key={i}
                    color={selectedQuery === i ? 'success' : 'neutral'}
                    onClick={() => setSelectedQuery(i)}
                    variant="solid"
                >
                    Q{i + 1}
                </Chip>
                ))}
            </Box>
        )}


      <Box mt={2}>
        <span>Workload Used: {benchmarkWorkload}</span>
      </Box>

      <Box textAlign="center" mt={2}>
        <Typography level="h3">
          {getSeriesLabel(selectedMetric)}
        </Typography>
      </Box>

      {loading ? (
        <Box textAlign="center" mt={4}>Loading data…</Box>
      ) : chartData.length ? (
        <ResponsiveContainer width="100%" height={600}>
          <BarChart data={chartData} margin={{ top: 40, bottom: 40 }}>
            <XAxis dataKey="target"/>
            <YAxis />
            <Tooltip formatter={(v: number) => v.toFixed(2)} />
            <Bar 
                dataKey="value" 
                isAnimationActive={false}
            >
                {chartData.map((entry, index) => (
                    <Cell
                    key={`cell-${index}`}
                    fill={colorMapping[entry.target] || '#8884d8'}
                    />
                ))}
                <LabelList
                    dataKey="value"
                    position="top"
                    style={{ fontSize: 32, fontWeight: 'bold' }} 
                    formatter={(v: number) =>
                    getBarLabel(selectedMetric, dataType, v)
                    }
                />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Box textAlign="center" mt={4}>
          No data available for the selected type and metric.
        </Box>
      )}
    </Box>
  );
}

export default ReCharts;