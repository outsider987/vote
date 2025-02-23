def to_camel_case(data):
    """Convert dictionary keys from snake_case to camelCase
    
    Args:
        data: Dictionary, list, or SQLAlchemy model instance with snake_case keys
        
    Returns:
        Dictionary or list with camelCase keys
    """
    # Handle SQLAlchemy model instances
    if hasattr(data, '__dict__') and hasattr(data, '__table__'):
        # Convert SQLAlchemy model to dict, excluding private attributes
        data = {k: v for k, v in data.__dict__.items() if not k.startswith('_')}

    if isinstance(data, dict):
        new_dict = {}
        for k, v in data.items():
            if k.startswith('_'):  # Skip private attributes
                continue
            new_key = ''.join(word.title() if i > 0 else word.lower() 
                            for i, word in enumerate(k.split('_')))
            new_dict[new_key] = to_camel_case(v)
        return new_dict
    elif isinstance(data, list):
        return [to_camel_case(item) for item in data]
    return data 