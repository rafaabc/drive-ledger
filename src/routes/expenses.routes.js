const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const expensesController = require('../controllers/expenses.controller');

const router = Router();

router.use(authMiddleware);

router.get('/summary', expensesController.summary);
router.get('/', expensesController.list);
router.get('/:id', expensesController.getOne);
router.post('/', expensesController.create);
router.put('/:id', expensesController.update);
router.delete('/:id', expensesController.remove);

module.exports = router;
