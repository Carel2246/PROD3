import sqlalchemy as sa
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os
import pandas as pd
import numpy as np

# Load environment variables from .env file
load_dotenv()

# Retrieve database credentials from environment variables
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_PORT = os.getenv("DB_PORT")

# Create SQLAlchemy engine
connection_string = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(connection_string)

# Function to connect to the database and fetch data
def fetch_data():
    try:
        # Establish connection using SQLAlchemy
        with engine.connect() as conn:
            print("Successfully connected to the database!")

            # Fetch data into Pandas DataFrames
            jobs_df = pd.read_sql_query("SELECT * FROM public.job;", conn)
            tasks_df = pd.read_sql_query("SELECT * FROM public.task;", conn)
            resources_df = pd.read_sql_query("SELECT * FROM public.resource;", conn)
            resource_groups_df = pd.read_sql_query("SELECT * FROM public.resource_group;", conn)
            resource_group_assoc_df = pd.read_sql_query("SELECT * FROM public.resource_group_association;", conn)
            calendar_df = pd.read_sql_query("SELECT * FROM public.calendar;", conn)
            schedule_df = pd.read_sql_query("SELECT * FROM public.schedule;", conn)

            # Inspect the resources field in tasks_df
            print("\nUnique values in tasks.resources:")
            print(tasks_df["resources"].unique())

            # Create a mapping of resource names to IDs
            resource_mapping = dict(zip(resources_df["name"], resources_df["id"]))
            print("\nResource Name to ID Mapping:")
            print(resource_mapping)

            # Create a mapping of resource group names to their list of resource IDs
            resource_group_mapping = {}
            for _, group in resource_groups_df.iterrows():
                group_name = group["name"]
                # Find all associations for this group
                group_assocs = resource_group_assoc_df[
                    resource_group_assoc_df["group_id"] == group["id"]
                ]
                # Get the resource IDs for this group
                resource_ids = group_assocs["resource_id"].tolist()
                resource_group_mapping[group_name] = resource_ids
            print("\nResource Group Name to Resource IDs Mapping:")
            print(resource_group_mapping)

            # Preprocess tasks: Convert numeric fields and parse resources/predecessors
            tasks_df["setup_time"] = pd.to_numeric(tasks_df["setup_time"], errors="coerce")
            tasks_df["time_each"] = pd.to_numeric(tasks_df["time_each"], errors="coerce")
            # Parse resources (e.g., "Pieter,GroupA" -> ["Pieter", "GroupA"])
            tasks_df["resources"] = tasks_df["resources"].apply(
                lambda x: [r.strip() for r in x.split(",")] if isinstance(x, str) and x else []
            )
            # Parse predecessors (e.g., "24356-120, 24356-270" -> ["24356-120", "24356-270"])
            tasks_df["predecessors"] = tasks_df["predecessors"].apply(
                lambda x: [] if pd.isna(x) or (isinstance(x, str) and x.lower() == "nan")
                else [p.strip() for p in x.split(",")] if isinstance(x, str) and x else []
            )

            # Print summaries
            print("\nJobs DataFrame:")
            print(jobs_df.head())
            print(f"Total jobs: {len(jobs_df)}")

            print("\nTasks DataFrame:")
            print(tasks_df.head())
            print(f"Total tasks: {len(tasks_df)}")

            print("\nResources DataFrame:")
            print(resources_df.head())
            print(f"Total resources: {len(resources_df)}")

            print("\nResource Groups DataFrame:")
            print(resource_groups_df.head())
            print(f"Total resource groups: {len(resource_groups_df)}")

            print("\nResource Group Associations DataFrame:")
            print(resource_group_assoc_df.head())
            print(f"Total resource group associations: {len(resource_group_assoc_df)}")

            print("\nCalendar DataFrame:")
            print(calendar_df.head())
            print(f"Total calendar entries: {len(calendar_df)}")

            print("\nSchedule DataFrame:")
            print(schedule_df.head())
            print(f"Total schedule entries: {len(schedule_df)}")

            return {
                "jobs": jobs_df,
                "tasks": tasks_df,
                "resources": resources_df,
                "resource_groups": resource_groups_df,
                "resource_group_assoc": resource_group_assoc_df,
                "calendar": calendar_df,
                "schedule": schedule_df,
                "resource_mapping": resource_mapping,
                "resource_group_mapping": resource_group_mapping
            }

    except Exception as e:
        print(f"Error fetching data: {e}")
        return None

# Function to analyze the data
def analyze_data(data):
    if data is None:
        print("No data to analyze.")
        return

    # Unpack the data
    jobs_df = data["jobs"]
    tasks_df = data["tasks"]
    resources_df = data["resources"]
    calendar_df = data["calendar"]

    # 1. Check for missing values
    print("\nMissing Values in Jobs:")
    print(jobs_df.isnull().sum())
    print("\nMissing Values in Tasks:")
    print(tasks_df.isnull().sum())
    print("\nMissing Values in Resources:")
    print(resources_df.isnull().sum())
    print("\nMissing Values in Calendar:")
    print(calendar_df.isnull().sum())

    # 2. Analyze task predecessors
    print("\nTasks with Predecessors:")
    tasks_with_predecessors = tasks_df[tasks_df["predecessors"].apply(len) > 0]
    print(tasks_with_predecessors[["job_number", "task_number", "predecessors"]])

    # 3. Analyze resource assignments
    print("\nTasks with Resource Assignments:")
    tasks_with_resources = tasks_df[tasks_df["resources"].apply(len) > 0]
    print(tasks_with_resources[["job_number", "task_number", "resources"]])

    # 4. Check calendar constraints
    print("\nCalendar Constraints by Day:")
    print(calendar_df.groupby("weekday")[["start_time", "end_time"]].first())

    # 5. Check for invalid predecessors
    print("\nTasks with Invalid Predecessors:")
    invalid_predecessors = tasks_df[tasks_df["predecessors"].apply(len) > 0].apply(
        lambda row: any(
            p not in tasks_df[tasks_df["job_number"] == row["job_number"]]["task_number"].values
            for p in row["predecessors"]
        ),
        axis=1
    )
    print(tasks_df[tasks_df["predecessors"].apply(len) > 0][invalid_predecessors])

if __name__ == "__main__":
    # Fetch the data
    data = fetch_data()
    # Analyze the data
    analyze_data(data)