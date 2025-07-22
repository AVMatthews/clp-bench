# UI

This is a web interface for viewing the benchmark results produced by `clp-bench`.

## Requirements

- Node.js
- Python v3.10 or higher

## Set up

The web interface includes a backend and a frontend.

### Backend

- Enter the `ui/backend` directory.
- Create a virtual `python3` environment under `/backend`:
  ```shell
  python3 -m venv venv
  ```
- Install dependencies:
  ```shell
  . venv/bin/activate
  pip install -r requirements.txt
  ```
- Run the backend:
  ```shell
  python3 app.py
  ```
- Leave `app.py` running and run the following in another window inside `ui/backend`
  ```shell
  . venv/bin/activate
  python3 load_results_from_results_dir.py 
  ```

### Frontend

- Enter the `/ui/frontend` directory.
- Install dependencies:
  ```
  npm install
  ```
- During development, you can run the frontend with:
  ```
  npm run dev
  ```
  - The command will print out the address of the web interface.
- In production, you can build the frontend with:
  ```
  npm run build
  ```
  - The frontend will be available through the backend's address.

### Configuration

There is a template `.env` file in this directory. To create a custom configuration, you may copy
`.env` to `.env.local` and modify the content, which will override the settings in `.env`.

# Benchmark results database

We use `sqlite` to manage a database that contains all benchmarking results. `load_results_from_results_dir.py `
automatically loads benchmarking results from the `/assets/results` directory which is separated semi-structured and unstructured log directories.
