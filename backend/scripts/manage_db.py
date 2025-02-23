import argparse
import os
import sys
from alembic.config import Config
from alembic import command

def main():
    parser = argparse.ArgumentParser(description='Database management script')
    parser.add_argument('action', choices=['migrate', 'upgrade', 'downgrade'], help='Action to perform')
    parser.add_argument('--message', '-m', help='Migration message')
    parser.add_argument('--revision', '-r', help='Revision identifier')
    
    args = parser.parse_args()
    
    # Get the directory containing this script
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Get the project root directory (parent of current directory)
    project_root = os.path.dirname(current_dir)
    
    # Add project root to Python path
    sys.path.append(project_root)
    
    # Ensure environment variables are loaded
    from app.core.config import settings
    
    # Create Alembic configuration
    alembic_cfg = Config(os.path.join(project_root, "alembic.ini"))
    
    if args.action == "migrate":
        # Create new migration
        command.revision(alembic_cfg, 
                        message=args.message,
                        autogenerate=True)
    
    elif args.action == "upgrade":
        # Upgrade to latest version or specified revision
        command.upgrade(alembic_cfg, 
                       args.revision or "head")
    
    elif args.action == "downgrade":
        # Downgrade to specified revision
        if not args.revision:
            print("Error: Please specify revision for downgrade")
            sys.exit(1)
        command.downgrade(alembic_cfg, args.revision)

if __name__ == "__main__":
    main() 