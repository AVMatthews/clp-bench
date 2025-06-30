import os
from typing import Tuple

from dotenv import load_dotenv
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Required by SQLAlchemy"""

    pass


db = SQLAlchemy(model_class=Base)


class BenchmarkingResult(db.Model):
    id: Mapped[int] = mapped_column(primary_key=True)
    """The ID of each result
    """
    target: Mapped[str] = mapped_column(nullable=False)
    """The short name of the tool to benchmark, which is also used by frontend to manage the results
    """
    target_displayed_name: Mapped[str] = mapped_column(nullable=False)
    """The name of the benchmarked tool which will be displayed in the UI
    """
    dataset: Mapped[str] = mapped_column(nullable=False)
    """The name of the dataset being benchmarked"""
    type: Mapped[int] = mapped_column(nullable=False)
    """The type of the results, type-0: debug, type-1: unstructured, type-2: dynamically-structured
    """
    color: Mapped[str] = mapped_column(nullable=False)
    """Hex Color string"""
    metric: Mapped[int] = mapped_column(nullable=False)
    """The metric of the results, metric-0: debug, metric-1: hot run, metric-2: cold run
    """
    ingest_time: Mapped[int] = mapped_column(nullable=True)
    """The end-to-end latency of ingestion, the unit is millisecond
    """
    compressed_size: Mapped[int] = mapped_column(nullable=True)
    """The size of data after compression, the unit is byte
    """
    avg_ingest_mem: Mapped[int] = mapped_column(nullable=True)
    """The average memory usage during ingesting data, the unit is byte
    """
    avg_query_mem: Mapped[int] = mapped_column(nullable=True)
    """The average memory usage during executing queries, the unit is byte
    """
    compression_ratio: Mapped[float] = mapped_column(nullable=True)
    """Compression Ratio
    """
    ingestion_speed: Mapped[float] = mapped_column(nullable=True)
    """The speed of ingestion, the unit is MB/s
    """
    size: Mapped[int] = mapped_column(nullable=True)
    """Original size of the dataset"""
    query_times: Mapped[str] = mapped_column(nullable=True)
    """The end-to-end latencies of queries executed during benchmarking, the unit is millisecond
    """

    __table_args__ = (UniqueConstraint("target", "dataset", "type", "metric", name="uix_target_type_metric"),)


def _define_routes(base_path: str):
    """This function defines some routes of the Flask backend"""

    @app.route(f"{base_path}/api/post", methods=["POST"])
    def add_result() -> Tuple[Response, int]:
        """This function handles the post request, which deposit the benchmark results to the SQL
        database

        :return: The status of the request
        """
        data = request.json
        print(data)
        new_benchmarking_result = BenchmarkingResult(
            target=data["target"],
            target_displayed_name=data["target_displayed_name"],
            dataset=data["dataset"],
            type=data["type"],
            color=data["color"],
            metric=data["metric"],
            ingest_time=data["ingest_time"],
            compressed_size=data["compressed_size"],
            avg_ingest_mem=data["avg_ingest_mem"],
            avg_query_mem=data["avg_query_mem"],
            compression_ratio=data["compression_ratio"],
            ingestion_speed=data["ingestion_speed"],
            size=data["size"],
            query_times=data["query_times"],
        )
        query = db.select(BenchmarkingResult)
        query = db.select(BenchmarkingResult).filter_by(
            target=data["target"],
            dataset=data["dataset"],
            type=data["type"],
            metric=data["metric"]
        )
        existed_benchmarking_result: BenchmarkingResult = (
            db.session.execute(query).scalars().first()
        )
        if existed_benchmarking_result:
            # Update existing record
            existed_benchmarking_result.target_displayed_name = new_benchmarking_result.target_displayed_name
            existed_benchmarking_result.color = new_benchmarking_result.color
            existed_benchmarking_result.ingest_time = new_benchmarking_result.ingest_time
            existed_benchmarking_result.compressed_size = new_benchmarking_result.compressed_size
            existed_benchmarking_result.avg_ingest_mem = new_benchmarking_result.avg_ingest_mem
            existed_benchmarking_result.avg_query_mem = new_benchmarking_result.avg_query_mem
            existed_benchmarking_result.compression_ratio = new_benchmarking_result.compression_ratio
            existed_benchmarking_result.ingestion_speed = new_benchmarking_result.ingestion_speed
            existed_benchmarking_result.size = new_benchmarking_result.size
            existed_benchmarking_result.query_times = new_benchmarking_result.query_times
        else:
            db.session.add(new_benchmarking_result)
        db.session.commit()
        return jsonify({"message": "success"}), 201

    @app.route(f"{base_path}/api/get", methods=["GET"])
    def get_results() -> Tuple[Response, int]:
        """This function handles the request of getting the benchmark results, which is sent by the
        UI. There are three arguments can be passed in URL as the search key to get benchmark
        results: target, type and metric

        :return: The query results (typically it will return all results because UI does not append
            any specified query arguments
        """
        target = request.args.get("target")
        dataset = request.args.get("dataset")
        type = request.args.get("type")
        metric = request.args.get("metric")
        results = []

        # Start building the query
        query = db.select(BenchmarkingResult)

        # Dynamically apply filters only if the parameter is provided
        if target:
            query = query.filter_by(target=target)
        if dataset:
            query = query.filter_by(dataset=dataset) 
        if type:
            query = query.filter_by(type=type)
        if metric:
            query = query.filter_by(metric=metric)

        rows = db.session.execute(query).scalars().all()
        for row in rows:
            if isinstance(row, BenchmarkingResult):
                results.append(
                    {
                        "target": row.target,
                        "target_displayed_name": row.target_displayed_name,
                        "dataset": row.dataset,
                        "type": row.type,
                        "color": row.color,
                        "metric": row.metric,
                        "ingest_time": row.ingest_time,
                        "compressed_size": row.compressed_size,
                        "avg_ingest_mem": row.avg_ingest_mem,
                        "avg_query_mem": row.avg_query_mem,
                        "compression_ratio": row.compression_ratio,
                        "ingestion_speed": row.ingestion_speed,
                        "size": row.size,
                        "query_times": row.query_times,
                    }
                )

        return jsonify({"message": "success", "payload": results}), 201
    
    @app.route(f"{base_path}/api/clear", methods=["DELETE"])
    def clear_database() -> Tuple[Response, int]:
        """This function clears all records from the BenchmarkingResult table."""
        try:
            db.session.query(BenchmarkingResult).delete()
            db.session.commit()
            return jsonify({"message": "Database cleared successfully."}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"message": "Error clearing database.", "error": str(e)}), 500


if __name__ == "__main__":
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_local_path = os.path.join(root_dir, ".env.local")
    env_path = os.path.join(root_dir, ".env")
    if os.path.exists(env_local_path):
        load_dotenv(env_local_path)
    else:
        load_dotenv(env_path)

    vite_frontend_base_path = os.getenv("VITE_FRONTEND_BASE_PATH", "")
    app = Flask(
        __name__, static_folder="../frontend/dist", static_url_path=f"{vite_frontend_base_path}/"
    )
    CORS(app)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("SQLALCHEMY_DATABASE_URI", "sqlite:///app.db")
    db.init_app(app)
    _define_routes(vite_frontend_base_path)
    with app.app_context():
        db.drop_all() 
        db.create_all()
    app.run(
        host=os.getenv("VITE_BACKEND_HOST", "127.0.0.1"), port=os.getenv("VITE_BACKEND_PORT", 5000)
    )
