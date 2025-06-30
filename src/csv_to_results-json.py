import csv
import json
from collections import defaultdict
import re
import os

def parse_number(value):
    """Convert strings like '1,234.56' to float or int."""
    if not value or value.strip() == '':
        return None
    value = value.replace(',', '')
    try:
        return int(float(value))
    except ValueError:
        return None

def main(input_csv, output_folder):
    with open(input_csv, newline='') as csvfile:
        reader = list(csv.reader(csvfile))

    # Extract system names
    headers = reader[0][3:]
    displayNames = reader[1][3:]
    typesRow = reader[2][3:]
    colorRow = reader[3][3:]
    #print(headers)
    systems = [name.strip() for name in headers]
    systemsLen = len(systems)
    systemDisplayNames = [name.strip() for name in displayNames]
    dataTypes = [parse_number(type.strip()) for type in typesRow]
    colors = [name.strip() for name in colorRow]
    print(systems)
    # Dictionary to store system data
    #TODO: remove display order and is Enables
    system_data = {name: {
        "target": systems[i],
        "targetDisplayedName": systemDisplayNames[i],
        "type": dataTypes[i],
        "color": colors[i],
        "datasets": []
    } for i, name in enumerate(systems)}

    """ for s in systems:
        print(system_data[s]) """
    datasets = []
    for row in reader:
        rowValue = row[0].strip()
        if rowValue != "" and rowValue != "Cold" and rowValue != "Hot":
            if rowValue not in datasets:
                datasets.append(rowValue)
                """ for i, name in enumerate(systems):
                    system_data[name][rowValue] = {
                        "ingestTime": None,
                        "compressedSize": None,
                        "avgIngestMem": None,
                        "metrics": []
                    } """
    """ for i, name in enumerate(systems):
        system_data[name]["datasets"] = datasets """
    

    # Helper for looking up rows by name
    def get_row(dataset, label, numSystems):
        for row in reader:
            if (row[0].strip() == dataset and row[2].strip() == label):
                return row[3:]
        return ['' for i in range(numSystems)]
    
    # Helper for looking up rows by name
    def get_query_row(dataset, run_type, label, numSystems):
        for row in reader:
            if (row[0].strip() == dataset and row[1].strip() == run_type and row[2].strip() == label):
                return row[3:]
        return ['' for i in range(numSystems)]

    ingestionTimes = []
    compressedSizes = []
    avgIngestMems = []
    compressionRatio = []
    ingestionSpeed = []
    size = []
    #List w/ 1 list per dataset, each containing 6 lists for the 6 queries
    #[dataset][query][system]
    coldTimes = []
    # List w/ 1 list per dataset, each containing one value for each system
    coldMem = []
    hotTimes = []
    hotMem = []

    for i,dataset in enumerate(datasets):
        # Ingestion data
        ingestionTimes.append(get_row(dataset, "Ingestion time (ms)", systemsLen))
        compressedSizes.append(get_row(dataset, "Compressed size (B)", systemsLen))
        avgIngestMems.append(get_row(dataset, "Ingestion memory usage (B)", systemsLen))
        compressionRatio.append(get_row(dataset, "Compression Ratio", systemsLen))
        ingestionSpeed.append(get_row(dataset, "Ingestion Speed (MB/s)", systemsLen))
        size.append(get_row(dataset, "Size (B)", systemsLen))
        # Cold queries
        coldTimes.append([get_query_row(dataset,"Cold", f"Q{i} time (ms)", systemsLen) for i in range(6)])
        coldMem.append(get_query_row(dataset, "Cold","Query memory usage (B)", systemsLen))

        # Hot queries
        hotTimes.append([get_query_row(dataset, "Hot",f"Q{i} time (ms)", systemsLen) for i in range(6)])
        hotMem.append(get_query_row(dataset, "Hot","Query memory usage (B)", systemsLen))

    #print(ingestionTimes)
    """ for i in range(len(datasets)):
        print(datasets[i])
        for j in range(len(systems)):
            print("Ingestion Time:", ingestionTimes[i][j]) """
    #print(compressedSizes)
    #print(avgIngestMems)
    #print(coldTimes)
    """ for i in range(len(datasets)):
        print(datasets[i])
        for j in range(6):
            print(f"Q{j} time (ms):", coldTimes[i][j]) """
    #print(coldMem)
    #print(hotTimes)
    #print(hotMem)

    for i, name in enumerate(systems):
        #print(datasets)
        for j, dataset in enumerate(datasets):  
            system_data[name]["datasets"].append({
                "dataset": dataset,
                "ingestTime": None,
                "compressedSize": None,
                "avgIngestMem": None,
                "compressionRatio": None,
                "ingestionSpeed": None,
                "size": None,
                "metrics": []
            })   
            system_data[name]["datasets"][j]["ingestTime"] = parse_number(ingestionTimes[j][i])
            system_data[name]["datasets"][j]["compressedSize"] = parse_number(compressedSizes[j][i])
            system_data[name]["datasets"][j]["avgIngestMem"] = parse_number(avgIngestMems[j][i])
            system_data[name]["datasets"][j]["compressionRatio"] = parse_number(compressionRatio[j][i])
            system_data[name]["datasets"][j]["ingestionSpeed"] = parse_number(ingestionSpeed[j][i])
            system_data[name]["datasets"][j]["size"] = parse_number(size[j][i])
            """ print(coldMem[j][i])
            for q in range(6):
                print(coldTimes[j][q][i]) """
            """ for q in range(6):
                if len(coldTimes[j][q]) """
            times = [parse_number(hotTimes[j][q][i]) for q in range(6)]
            avg_mem = parse_number(hotMem[j][i])
            #print(times)
            #print(avg_mem)
            system_data[name]["datasets"][j]["metrics"].append({
                "metric": 1,
                "avgQueryMem": avg_mem,
                "queryTimes": times
            })
            times = [parse_number(coldTimes[j][q][i]) for q in range(6)]
            avg_mem = parse_number(coldMem[j][i])
            #print(times)
            #print(avg_mem)
            system_data[name]["datasets"][j]["metrics"].append({
                "metric": 2,
                "avgQueryMem": avg_mem,
                "queryTimes": times
            })

    # Write each system's data to a JSON file
    for name, data in system_data.items():
        filename = f"{output_folder}/{data['target']}.json"
        with open(filename, 'w') as f:
            json.dump(data, f, indent=4)

    print(f"Exported {len(system_data)} JSON files to '{output_folder}'")

if __name__ == "__main__":
    input_csv = "../../benchmark_multiDataset.csv"
    output_folder = "../../json_output_multiDataset"

    os.makedirs(output_folder, exist_ok=True)
    main(input_csv, output_folder)
