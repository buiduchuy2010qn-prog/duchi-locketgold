import React from 'react';
import { motion } from 'framer-motion';

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // Độ trễ 0.05s cho mỗi phần tử con
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/**
 * StaggeredList & StaggeredItem
 * 
 * Usage Example (List):
 * <StaggeredList as="ul" className="space-y-2">
 *   {items.map(item => (
 *     <StaggeredItem as="li" key={item.id}>{item.name}</StaggeredItem>
 *   ))}
 * </StaggeredList>
 * 
 * Usage Example (Table):
 * <StaggeredList as="tbody">
 *   <StaggeredItem as="tr">...</StaggeredItem>
 * </StaggeredList>
 */
export const StaggeredList = ({ children, className = '', as = 'ul', ...props }) => {
  const Component = motion[as] || motion.ul;

  return (
    <Component
      variants={listVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
};

export const StaggeredItem = ({ children, className = '', as = 'li', ...props }) => {
  const Component = motion[as] || motion.li;
  
  return (
    <Component
      variants={itemVariants}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
};
