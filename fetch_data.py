import sqlalchemy as sa
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os
import pandas as pd
import numpy as np
import logging
from pathlib import Path

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent.absolute()

# Setup logging with a relative path
log_file = SCRIPT_DIR / 'fetch_data.log'
logging.basicConfig(
    filename=str(log_file),
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Check if .env file exists
env_path = SCRIPT_DIR / '.env'
if not env_path.exists():
    logging.error(f".env file not found at {env_path}")
    raise FileNotFoundError(f".env file not found at {env_path}")

# Load environment variables
load_dotenv(env_path)
logging.debug(f"Environment variables loaded from {env_path}")

# Debug: Print all environment variables (excluding sensitive data)
logging.debug("Environment variables:")
for key in os.environ:
    if 'DATABASE' in key:
        logging.debug(f"{key}: {os.environ[key]}")

# Retrieve database URL
db_url = os.getenv('DATABASE_URL')
if not db_url:
    logging.error("DATABASE_URL is not set in environment variables")
    raise ValueError("DATABASE_URL is not set")
logging.debug(f"Database URL: {db_url}")

# Create SQLAlchemy engine with better error handling
try:
    engine = create_engine(db_url, connect_args={'connect_timeout': 5})
    logging.debug("SQLAlchemy engine created")
except Exception as e:
    logging.error(f"Error creating engine: {str(e)}")
    raise

def fetch_data():
    try:
        with engine.connect() as conn:
            logging.debug("Database connection established")
            print("Successfully connected to the database!")

            # Fetch all required data with error handling for each query
            try:
                jobs_df = pd.read_sql_query("SELECT * FROM public.job;", conn)
                tasks_df = pd.read_sql_query("SELECT * FROM public.task;", conn)
                resources_df = pd.read_sql_query("SELECT * FROM public.resource;", conn)
                resource_groups_df = pd.read_sql_query("SELECT * FROM public.resource_group;", conn)
                resource_group_assoc_df = pd.read_sql_query("SELECT * FROM public.resource_group_association;", conn)
                calendar_df = pd.read_sql_query("SELECT * FROM public.calendar;", conn)
                schedule_df = pd.read_sql_query("SELECT * FROM public.schedule;", conn)
                holidays_df = pd.read_sql_query("SELECT date, start_time, end_time, resources FROM public.holidays;", conn)
            except Exception as e:
                logging.error(f"Error executing SQL queries: {str(e)}")
                raise

            print("\nUnique values in tasks.resources (raw):")
            print(tasks_df["resources"].unique())
            logging.debug(f"Raw unique resources: {tasks_df['resources'].unique()}")

            print("\nUnique values in tasks.predecessors (raw):")
            print(tasks_df["predecessors"].unique())
            logging.debug(f"Raw unique predecessors: {tasks_df['predecessors'].unique()}")

            resource_mapping = dict(zip(resources_df["name"], resources_df["id"]))
            print("\nResource Name to ID Mapping:")
            print(resource_mapping)
            logging.debug(f"Resource mapping: {resource_mapping}")

            resource_group_mapping = {}
            for _, group in resource_groups_df.iterrows():
                group_name = group["name"]
                group_assocs = resource_group_assoc_df[resource_group_assoc_df["group_id"] == group["id"]]
                resource_ids = group_assocs["resource_id"].tolist()
                resource_group_mapping[group_name] = resource_ids
            print("\nResource Group Name to Resource IDs Mapping:")
            print(resource_group_mapping)
            logging.debug(f"Resource group mapping: {resource_group_mapping}")

            tasks_df["setup_time"] = pd.to_numeric(tasks_df["setup_time"], errors="coerce")
            tasks_df["time_each"] = pd.to_numeric(tasks_df["time_each"], errors="coerce")

            # Validate calendar data
            for _, row in calendar_df.iterrows():
                if pd.isna(row["start_time"]) or pd.isna(row["end_time"]):
                    logging.warning(f"Missing start_time or end_time for weekday {row['weekday']}")
                elif row["start_time"] >= row["end_time"]:
                    logging.warning(f"Invalid working hours for weekday {row['weekday']}: {row['start_time']} >= {row['end_time']}")

            # Process holidays
            holidays_df["resources"] = holidays_df["resources"].apply(lambda x: x if isinstance(x, list) and x else [])
            holidays_df["date"] = pd.to_datetime(holidays_df["date"]).dt.strftime("%Y-%m-%d")
            holidays_df["start_time"] = holidays_df["start_time"].apply(lambda x: x.strftime("%H:%M") if pd.notna(x) else None)
            holidays_df["end_time"] = holidays_df["end_time"].apply(lambda x: x.strftime("%H:%M") if pd.notna(x) else None)

            def parse_resources(x):
                try:
                    if pd.isna(x) or x is None or x == '':
                        logging.debug(f"Resources is NULL, None, or empty: {x}")
                        return []
                    if isinstance(x, (list, tuple)):
                        return [str(r).strip() for r in x if str(r).strip()]
                    if isinstance(x, np.ndarray):
                        return [str(r).strip() for r in x.flatten() if str(r).strip()]
                    if isinstance(x, str):
                        return [r.strip() for r in x.split(",") if r.strip()]
                    logging.warning(f"Unexpected resources format: {x}, type={type(x)}")
                    return []
                except Exception as e:
                    logging.error(f"Error parsing resources '{x}': {e}")
                    return []

            def parse_predecessors(x):
                try:
                    if pd.isna(x) or x is None or x == '':
                        logging.debug(f"Predecessors is NULL, None, or empty: {x}")
                        return []
                    if isinstance(x, (list, tuple)):
                        return [str(p).strip() for p in x if str(p).strip()]
                    if isinstance(x, np.ndarray):
                        return [str(p).strip() for p in x.flatten() if str(p).strip()]
                    if isinstance(x, str):
                        return [p.strip() for p in x.split(",") if p.strip()]
                    logging.warning(f"Unexpected predecessors format: {x}, type={type(x)}")
                    return []
                except Exception as e:
                    logging.error(f"Error parsing predecessors '{x}': {e}")
                    return []

            # Apply parsing
            tasks_df["resources"] = tasks_df["resources"].apply(parse_resources)
            tasks_df["predecessors"] = tasks_df["predecessors"].apply(parse_predecessors)

            # Validate resources and predecessors
            invalid_resources = tasks_df[~tasks_df["resources"].apply(lambda x: isinstance(x, list))]
            invalid_predecessors = tasks_df[~tasks_df["predecessors"].apply(lambda x: isinstance(x, list))]
            if not invalid_resources.empty:
                logging.error(f"Invalid resources format in tasks:\n{invalid_resources[['job_number', 'resources']].to_dict()}")
                print(f"Error: Invalid resources format in tasks:\n{invalid_resources[['job_number', 'task_number', 'resources']]}")
                raise ValueError("Invalid resources format detected")
            if not invalid_predecessors.empty:
                errors.append(f"Invalid predecessors format in tasks:\n{invalid_predecessors[['job_number', 'task_number', 'predecessors']].to_dict()}")
                print(f"Error: Invalid predecessors format in tasks:\n{invalid_predecessors[['job_number', 'task_number', 'predecessors']]}")
                raise ValueError("Invalid predecessors format detected")

            print("\nUnique values in tasks.resources (processed):")
            print(tasks_df["resources"].apply(str).unique())
            logging.debug(f"Processed unique resources: {tasks_df['resources'].apply(str).unique()}")

            print("\nUnique values in tasks.predecessors (processed):")
            print(tasks_df["predecessors"].apply(str).unique())
            logging.debug(f"Processed unique predecessors: {tasks_df['predecessors'].apply(str).unique()}")

            print("\nJobs DataFrame:")
            print(jobs_df.head())
            print(f"Total jobs: {len(jobs_df)}")

            print("\nTasks DataFrame:")
            print(tasks_df.head())
            print(f"Total tasks: {len(tasks_df)}")

            print("\nHolidays DataFrame:")
            print(holidays_df.head())
            print(f"Total holidays: {len(holidays_df)}")
            logging.debug(f"Holidays data:\n{holidays_df.to_dict()}")

            return {
                "jobs": jobs_df,
                "tasks": tasks_df,
                "resources": resources_df,
                "resource_groups": resource_groups_df,
                "resource_group_assoc": resource_group_assoc_df,
                "calendar": calendar_df,
                "schedule": schedule_df,
                "holidays": holidays_df,
                "resource_mapping": resource_mapping,
                "resource_group_mapping": resource_group_mapping
            }

    except Exception as e:
        print(f"Error fetching data: {e}")
        logging.error(f"Error fetching data: {e}")
        return None

def analyze_data(data):
    if data is None:
        print("No data to analyze.")
        logging.warning("No data to analyze")
        return

    jobs_df = data["jobs"]
    tasks_df = data["tasks"]
    resources_df = data["resources"]
    calendar_df = data["calendar"]
    holidays_df = data.get("holidays")

    print("\nMissing Values in Jobs:")
    print(jobs_df.isnull().sum())
    logging.debug(f"Missing values in jobs:\n{jobs_df.isnull().sum().to_dict()}")
    print("\nMissing Values in Tasks:")
    print(tasks_df.isnull().sum())
    logging.debug(f"Missing values in tasks:\n{tasks_df.isnull().sum().to_dict()}")
    print("\nMissing Values in Resources:")
    print(resources_df.isnull().sum())
    logging.debug(f"Missing values in resources:\n{resources_df.isnull().sum().to_dict()}")
    print("\nMissing Values in Calendar:")
    print(calendar_df.isnull().sum())
    logging.debug(f"Missing values in calendar:\n{calendar_df.groupby('weekday')[['start_time', 'end_time']].first().to_dict()}")

    if holidays_df is not None:
        print("\nMissing Values in Holidays:")
        print(holidays_df.isnull().sum())
        logging.debug(f"Missing values in holidays:\n{holidays_df.isnull().sum().to_dict()}")

    print("\nTasks with Predecessors:")
    tasks_with_predecessors = tasks_df[tasks_df["predecessors"].apply(len) > 0]
    print(tasks_with_predecessors[["job_number", "task_number", "predecessors"]])
    logging.debug(f"Tasks with predecessors:\n{tasks_with_predecessors[['job_number', 'task_number', 'predecessors']].to_dict()}")

    print("\nTasks with Resource Assignments:")
    tasks_with_resources = tasks_df[tasks_df["resources"].apply(len) > 0]
    print(tasks_with_resources[["job_number", "task_number", "resources"]])
    logging.debug(f"Tasks with resources:\n{tasks_with_resources[['job_number', 'task_number', 'resources']].to_dict()}")

    print("\nCalendar Constraints by Day:")
    print(calendar_df.groupby("weekday")[["start_time", "end_time"]].first())
    logging.debug(f"Calendar constraints:\n{calendar_df.groupby('weekday')[['start_time', 'end_time']].first().to_dict()}")

    if holidays_df is not None:
        print("\nHolidays:")
        print(holidays_df[["date", "start_time", "end_time", "resources"]])
        logging.debug(f"Holidays:\n{holidays_df[['date', 'start_time', 'end_time', 'resources']].to_dict()}")

    print("\nTasks with Invalid Predecessors:")
    invalid_predecessors = tasks_df[tasks_df["predecessors"].apply(len) > 0].apply(
        lambda row: any(
            p not in tasks_df["task_number"].values
            for p in row["predecessors"]
        ),
        axis=1
    )
    invalid_tasks = tasks_df[tasks_df["predecessors"].apply(len) > 0][invalid_predecessors]
    print(invalid_tasks[["job_number", "task_number", "predecessors"]])
    logging.debug(f"Invalid predecessors:\n{invalid_tasks[['job_number', 'task_number', 'predecessors']].to_dict()}")

if __name__ == "__main__":
    data = fetch_data()
    if data:
        print("Data fetched successfully")
        analyze_data(data)
    else:
        print("Failed to fetch data")