import json
import os

import requests
from dotenv import load_dotenv

ui_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
env_local_path = os.path.join(ui_root_dir, ".env.local")
env_path = os.path.join(ui_root_dir, ".env")
if os.path.exists(env_local_path):
    load_dotenv(env_local_path)
else:
    load_dotenv(env_path)
host = os.getenv("VITE_BACKEND_HOST", "127.0.0.1")
port = os.getenv("VITE_BACKEND_PORT", 5000)
base_path = os.getenv("VITE_FRONTEND_BASE_PATH", "")
url = f"http://{host}:{port}{base_path}/api/post"

project_root_dir = os.path.abspath(os.path.join(ui_root_dir, ".."))
assets_dir = os.path.abspath(os.path.join(project_root_dir, "assets/results"))
type_dirs = os.listdir(assets_dir)
print(type_dirs)
results = []
# Iterate over assets/ and get results automatically
for type_dir in type_dirs:
    if(".DS_Store" == type_dir):
        continue
    type_path = os.path.join(assets_dir, type_dir)
    print(type_path)
    targets = os.listdir(type_path)
    print(targets)
    for target in targets:
        if ".DS_Store" == target:
            continue
        results_of_target = json.load(open(os.path.join(type_path, target), "r"))

        target_name = results_of_target["target"]
        target_displayed_name = results_of_target["targetDisplayedName"]
        type_value = results_of_target["type"]
        color = results_of_target["color"]

        for dataset in results_of_target["datasets"]:
            dataset_name = dataset["dataset"]
            ingest_time = dataset["ingestTime"]
            compressed_size = dataset["compressedSize"]
            avg_ingest_mem = dataset["avgIngestMem"]
            compression_ratio = dataset["compressionRatio"]
            ingestion_speed = dataset["ingestionSpeed"]
            size = dataset["size"]
            
            for metric in dataset["metrics"]:
                metric_value = metric["metric"]
                avg_query_mem = metric["avgQueryMem"]
                query_times = metric["queryTimes"]
                
                results.append(
                    (
                        (
                            target_name,
                            target_displayed_name,
                            dataset_name,
                            type_value,
                            color,
                            metric_value,
                            ingest_time,
                            compressed_size,
                            avg_ingest_mem,
                            avg_query_mem,
                            compression_ratio,
                            ingestion_speed,
                            size
                        ),
                        tuple(query_times),
                    )
                )
print(results)

def dump_and_post():
    """This function construct the request for each benchmark result and send it to the Flask
    backend"""
    headers = {"Content-Type": "application/json"}
    for result in results:
        payload = json.dumps(
            {
                "target": result[0][0],
                "target_displayed_name": result[0][1],
                "dataset": result[0][2],
                "type": result[0][3],
                "color": result[0][4],
                "metric": result[0][5],
                "ingest_time": result[0][6],
                "compressed_size": result[0][7],
                "avg_ingest_mem": result[0][8],
                "avg_query_mem": result[0][9],
                "compression_ratio": result[0][10],
                "ingestion_speed": result[0][11],
                "size": result[0][12],
                "query_times": str(list(result[1])),
            }
        )
        response = requests.request("POST", url, headers=headers, data=payload)
        print(response.text)

def clear_database():
    """This function sends a request to clear the database."""
    url_clear = f"http://{host}:{port}{base_path}/api/clear"
    response = requests.delete(url_clear)
    print(response.text)

clear_database()
dump_and_post()
