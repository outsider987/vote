from fastapi import APIRouter
from app.routers import event_routes, vote_routes, ticket_routes

router = APIRouter()

# Include the routers
router.include_router(event_routes.router)
router.include_router(vote_routes.router) 
router.include_router(ticket_routes.router)