from fastapi import APIRouter
from app.routers import event_routes, vote_routes, ticket_routes, auth_routes, permission_routes

router = APIRouter()

# Include the routers
router.include_router(event_routes.router)
router.include_router(vote_routes.router) 
router.include_router(ticket_routes.router)
# router.include_router(admin_routes.router)
router.include_router(auth_routes.router, prefix="/auth", tags=["authentication"])
router.include_router(permission_routes.router)